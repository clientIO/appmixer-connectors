'use strict';

const eachDelay = require('./EachDelay');

function parseVariable(listVariable) {

    const re = new RegExp(/{{{(.*?)}}}/g);
    return re.exec(listVariable)[1];
}

/**
 * Returns input transformation config (lambda)
 * @param {Object} componentConfig
 * @return {Object|null}
 */
function getInputConfig(componentConfig) {

    try {
        for (let senderId in componentConfig) {
            const senderConfig = componentConfig[senderId];
            for (let senderPort in senderConfig) {
                if (senderConfig.hasOwnProperty(senderPort)) {
                    return {
                        listVariable: `{{{${Object.values(senderConfig[senderPort]?.modifiers?.list)[0].variable}}}}`,
                        senderId: senderId,
                        senderPort: senderPort,
                        modifiers: Object.values(senderConfig[senderPort]?.modifiers?.list)[0].functions || []
                    };
                }
            }
        }
    } catch (err) {
        // The Each input has to be a `list`. And it has to be a list defined by a variable. In all other cases
        // return null
        return null;
    }

    return null;
}

const generateOutputPortOptions = async function(context) {

    const componentConfig = context.flowDescriptor[context.componentId].config?.transform['in'] || {};
    const inputConfig = getInputConfig(componentConfig);

    if (inputConfig) {
        if (!inputConfig.modifiers.length) {
            const [, componentId, port, ...rootVariableParts] = parseVariable(inputConfig.listVariable)
                .split('.');
            const allProperties = await context.loadOutputSchemaProperties(componentId);
            const portProperties = allProperties[port];

            const basePath = `${port}.${rootVariableParts.join('.')}`;
            const variableProperties = portProperties.filter(prop => {
                return prop.path.startsWith(basePath) && prop.path !== basePath;
            });

            // Exclude properties that have a subproperty parent that is an array, since those wouldn't be accesible
            const arrayFilteredProperties = variableProperties.filter(prop => {
                const hasArrayParent = variableProperties.some(varProp => {
                    const isParent = prop.path.startsWith(varProp.path) && prop.path !== varProp.path;
                    if (!isParent) {
                        return false;
                    }

                    return varProp.type === 'array';
                });
                return !hasArrayParent;
            });

            const mappedProperties = arrayFilteredProperties.map(prop => {
                const fallbackLabel = prop.path.replace(basePath, 'item');
                const value = prop.path.replace(basePath, 'value');
                return { label: prop.label || fallbackLabel, value };
            });

            return context.sendJson([
                ...mappedProperties,
                { label: 'Index', value: 'index' },
                { label: 'Value', value: 'value' },
                { label: 'Items Count', value: 'count' },
                { label: 'Correlation ID', value: 'correlationId' }
            ], 'item');
        }
    }

    return context.sendJson([
        { label: 'Index', value: 'index' },
        { label: 'Value', value: 'value' },
        { label: 'Items Count', value: 'count' },
        { label: 'Correlation ID', value: 'correlationId' }
    ], 'item');
};

const getItemsList = function(context, list) {
    if (typeof list === 'string') {
        // Try to parse string as JSON.
        try {
            list = JSON.parse(list);
        } catch (error) {
            throw new context.CancelError(
                'Property \'list\' should be array or well formed JSON array string. ' +
                'In case of CSV string, use modifier \'Split\' to create an Array.',
                error
            );
        }
    }

    return list;
};


module.exports = {

    async receive(context) {

        const { buildOutPortOptions = false } = context.properties;

        if (context.messages.timeout) {
            // A scheduled timeout drives the next batch of a delayed Each loop.
            return eachDelay.handleTimeout(context);
        }

        if (buildOutPortOptions) {
            return await generateOutputPortOptions(context);
        }

        let list = getItemsList(context, context.messages.in.content.list);

        // Use context.id as the Each<->JoinEach pairing correlation ID. It is unique per Each
        // execution (so it never collides across runs, including nested Each) yet stays identical
        // when the engine re-delivers this `in` message after an error - so a re-delivered run reuses
        // the SAME correlation ID without generating one or relying on persisted state. Note this is
        // intentionally NOT the message-envelope correlationId (context.messages.in.correlationId),
        // which can be shared across the items of a parent Each and would collide in nested loops.
        const eachCorrelationId = context.id;

        // Normalize and validate the delay. The inspector is numeric, but a transform/lambda can feed
        // any value (a non-numeric string, an object, ...). An invalid delay must be rejected here:
        // otherwise it flows into the delayed path as a NaN/negative batch size, producing empty
        // batches that never advance the index and re-schedule timeouts forever.
        const rawDelay = context.messages.in.content.delay;
        const delay = (rawDelay == null || rawDelay === '') ? 0 : Number(rawDelay);
        if (!Number.isFinite(delay) || delay < 0) {
            throw new context.CancelError('Property \'delay\' must be a non-negative number (milliseconds).');
        }

        if (!Array.isArray(list)) {
            // Not an array, send empty done
            await context.sendJson({ count: 0, correlationId: eachCorrelationId }, 'done');
            return;
        }

        const count = list.length;

        if (delay) {
            // Delayed iteration is batched and timeout-driven - see EachDelay.js.
            return eachDelay.handleDelayedStart(context, {
                list,
                correlationId: eachCorrelationId,
                count,
                delay
            });
        }

        // No delay - process all items immediately
        const contextId = context.id;
        const lastSentIndexCache = await context.stateGet(contextId);
        const resumeOffset = lastSentIndexCache?.index || 0;
        if (lastSentIndexCache) {
            list = list.slice(resumeOffset);
        }
        for (let i = 0; i < list.length; i++) {
            const absoluteIndex = i + resumeOffset;
            const listItem = {
                index: absoluteIndex,
                value: list[i],
                count,
                correlationId: eachCorrelationId
            };
            await context.sendJson(listItem, 'item');
            // Persist the ABSOLUTE index so a crash + resume continues from the right place
            // (storing the local loop index here would re-send already-processed items).
            await context.stateSet(contextId, {
                index: absoluteIndex
            });
        }

        await context.sendJson({ count, correlationId: eachCorrelationId }, 'done');
        // at this point we will remove the store index. Otherwise, the state would keep growing until it would
        // reach the limit of the document
        return context.stateUnset(contextId);
        // if now the engine crashes, the array and all its items would be sent to the output port again
    }
};
