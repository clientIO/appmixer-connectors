'use strict';
const uuid = require('uuid');

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

module.exports = {

    async receive(context) {

        const { buildOutPortOptions = false } = context.properties;
        if (buildOutPortOptions) {

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

        } else {
            let { list } = context.messages.in.content;
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

            let count = 0;
            const eachCorrelationId = uuid.v4();

            if (Array.isArray(list)) {
                count = list.length;
                const contextId = context.id;
                const lastSentIndexCache = await context.stateGet(contextId);
                if (lastSentIndexCache) {
                    list = list.slice(lastSentIndexCache.index);
                }
                for (let i = 0; i < list.length; i++) {
                    const listItem = {
                        index: i + (lastSentIndexCache?.index || 0),
                        value: list[i],
                        count,
                        correlationId: eachCorrelationId
                    };
                    await context.sendJson(listItem, 'item');
                    await context.stateSet(contextId, {
                        index: i
                    });
                }
            }

            await context.sendJson({ count, correlationId: eachCorrelationId }, 'done');
            // at this point we will remove the store index. Otherwise, the state would keep growing until it would
            // reach the limit of the document
            return context.stateUnset(context.id);
            // if now the engine crashes, the array and all its items would be sent to the output port again
        }
    }
};
