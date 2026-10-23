'use strict';

/**
 * toolChain.js — a tool made of several components.
 *
 * The component wired to the "tool" port is the first step of a tool. Every component
 * connected behind it is another step: Generate Embeddings -> Query Vectors is one
 * retrieval tool. There is no ToolStart in front and no ToolOutput at the end; the
 * output of the last step is what the model gets back.
 *
 * The steps are not run by the flow engine. Like the first component (see tool.js),
 * each one is called statically, and its input is built here from the mapping the
 * user made in the flow:
 *
 *   - a literal value is passed as it is,
 *   - a field filled with "Model Defined Parameter" becomes a parameter of the tool,
 *   - a field with flow variables (of an earlier step, or of anything in front of the
 *     agent) is resolved by the engine itself (POST /modifiers/transform), so variable
 *     modifiers behave exactly as they do in a running flow.
 *
 * When a step sends several messages, the next one runs for each of them and the tool
 * returns a list (Find Emails -> Get Email returns the content of every email found).
 *
 * Limits: the chain is a straight line, a flow that branches inside a tool does not
 * start. An output of a component in front of the agent that the engine moved out of
 * the message (over 2 kB by default) cannot be read here; the tool call fails with an
 * error saying so.
 */

const TOOL_PORT = 'tool';
const MODEL_PARAMETER = 'modelDefinedParameter';
const TOOL_OUTPUT_TYPE = 'appmixer.ai.agenttools.ToolOutput';
const VARIABLE = /\{\{\{[^{}]+\}\}\}/;
// Arrays longer than this (embedding vectors) are summarized in the logs.
const MAX_LOGGED_ARRAY = 20;
// How many messages of one step the next step is run for (AI_AGENT_TOOL_MAX_ITEMS overrides it).
const MAX_ITEMS = 50;

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Components fed from `componentId`, with the ports the connection uses.
 */
function findSuccessors(flowDescriptor, componentId) {
    const successors = [];
    for (const [id, component] of Object.entries(flowDescriptor)) {
        for (const [inPort, sources] of Object.entries(component.source || {})) {
            // A stored flow may hold a single port as a string.
            const ports = [].concat(sources?.[componentId] || []);
            if (ports.length) {
                successors.push({ id, inPort, sourcePort: ports[0] });
            }
        }
    }
    return successors;
}

/**
 * Does the value of an input hold a flow variable? Inputs such as filters are objects
 * with the variables somewhere inside.
 */
function hasVariable(value) {
    if (typeof value === 'string') return VARIABLE.test(value);
    return value !== null && typeof value === 'object' && VARIABLE.test(JSON.stringify(value));
}

/**
 * A tool parameter for an input the model fills. 'enum' and 'items' go along with the
 * type: OpenAI refuses a function whose array parameter has no 'items'.
 */
function toParameter(schema, input, key) {
    const parameter = {
        type: schema?.type || 'string',
        description: [input?.label, input?.tooltip].filter(Boolean).join(' — ') || key
    };
    if (schema?.enum) parameter.enum = schema.enum;
    if ([].concat(parameter.type).includes('array')) parameter.items = schema?.items || {};
    return parameter;
}

/**
 * The properties set on a component in the flow. A static call does not load them from
 * the flow, so they are sent with it. Only the ones the component declares are taken.
 */
function pickProperties(component, manifest) {
    const declared = Object.keys(manifest?.properties?.schema?.properties || {});
    const values = component?.config?.properties || {};
    return Object.fromEntries(declared
        .filter((key) => values[key] !== undefined && values[key] !== null && values[key] !== '')
        .map((key) => [key, values[key]]));
}

/**
 * How each input of a step gets its value.
 */
function readFields(transform) {
    const lambda = transform?.lambda || {};
    const modifiers = transform?.modifiers || {};
    const fields = {};

    for (const [key, value] of Object.entries(lambda)) {
        const variables = modifiers[key] && typeof modifiers[key] === 'object' ? modifiers[key] : {};
        const isModelDefined = Object.values(variables)
            .some((entry) => entry?.variable && entry.variable.includes(MODEL_PARAMETER));

        if (isModelDefined) {
            fields[key] = { kind: 'model' };
        } else if (hasVariable(value)) {
            fields[key] = { kind: 'variable', value, variables };
        } else if (value !== null && value !== undefined && value !== '') {
            fields[key] = { kind: 'static', value };
        }
    }
    return fields;
}

/**
 * Complete the definition built for the component on the "tool" port:
 *
 *   - `_variableFields`: its fields mapped to flow variables (tool.js itself only
 *     knows literals and model defined fields),
 *   - `_chain`: the components connected behind it, with their model defined fields
 *     added to the tool parameters and their descriptions to the tool description.
 *
 * @param {object} context
 * @param {object} toolDef
 * @param {function} fetchManifest - (context, componentType) => manifest
 */
async function extendToolDef(context, toolDef, fetchManifest) {
    const flowDescriptor = context.flowDescriptor;
    const fn = toolDef.function;
    const { _componentId: firstComponentId, _inPort: firstInPort } = fn;

    const firstTransform = flowDescriptor[firstComponentId]?.config?.transform
        ?.[firstInPort]?.[context.componentId]?.[TOOL_PORT];
    const variableFields = Object.fromEntries(
        Object.entries(readFields(firstTransform)).filter(([, field]) => field.kind === 'variable')
    );
    if (Object.keys(variableFields).length) {
        Object.assign(fn, { _variableFields: variableFields });
    }

    const visited = new Set([context.componentId, firstComponentId]);
    const steps = [];
    const descriptions = [];
    let previousId = firstComponentId;

    for (;;) {
        const successors = findSuccessors(flowDescriptor, previousId)
            .filter((next) => !visited.has(next.id) && flowDescriptor[next.id].type !== TOOL_OUTPUT_TYPE);
        if (!successors.length) break;
        if (successors.length > 1) {
            // Running only a part of what the user connected would return a wrong output quietly.
            throw new context.CancelError(`The tool starting with component ${firstComponentId} branches behind
                component ${previousId}. A tool connected to the '${TOOL_PORT}' port of the AI Agent has to be
                a straight line of components. Use the 'tools' port with 'ToolStart' and 'ToolOutput'
                for a tool that branches.`);
        }

        const [next] = successors;
        const component = flowDescriptor[next.id];
        let manifest = {};
        try {
            manifest = await fetchManifest(context, component.type) || {};
        } catch (err) {
            // Only the parameter descriptions come from the manifest; the step still runs.
            await context.log({
                step: 'component-tool-manifest-error',
                componentId: next.id,
                type: component.type,
                error: err.message
            });
        }

        const inPortDef = (manifest.inPorts || []).find((port) => port.name === next.inPort) || {};
        const fields = readFields(component.config?.transform?.[next.inPort]?.[previousId]?.[next.sourcePort]);

        for (const [key, field] of Object.entries(fields)) {
            if (field.kind !== 'model') continue;
            fn.parameters = fn.parameters || { type: 'object', properties: {} };
            // Two steps can have a field of the same name; the later one gets a suffix.
            field.parameter = key in fn.parameters.properties ? `${key}_${steps.length + 2}` : key;
            fn.parameters.properties[field.parameter] = toParameter(
                inPortDef.schema?.properties?.[key], inPortDef.inspector?.inputs?.[key], key
            );
            if ((inPortDef.schema?.required || []).includes(key)) {
                fn.parameters.required = [...(fn.parameters.required || []), field.parameter];
            }
        }

        steps.push({
            componentId: next.id,
            componentType: manifest.name || component.type,
            label: component.label || manifest.label || component.type.split('.').pop(),
            inPort: next.inPort,
            sourceId: previousId,
            sourcePort: next.sourcePort,
            fields,
            properties: pickProperties(component, manifest)
        });
        if (manifest.description) descriptions.push(manifest.description);
        visited.add(next.id);
        previousId = next.id;
    }

    if (steps.length) {
        // The descriptions of the components only say what each one does. Without the last
        // sentence the model reads the first one and expects that component's output.
        Object.assign(fn, {
            _chain: steps,
            description: [fn.description, ...descriptions].join(' Then: ')
                + ' The tool runs these steps in a row and returns the output of the last step,'
                + ' one result for every item when a step returns several.'
        });
    }
    return toolDef;
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Outputs of the components in front of the agent, keyed by component and port. They
 * travel in the scope of the agent's input message.
 */
function getScope(context) {
    return context.messages?.in?.scope || {};
}

/**
 * Resolve fields mapped to flow variables. The engine does it, so that modifiers
 * (g_jsonPath and the like) and typing work the way they do in a running flow.
 *
 * @param {object} context
 * @param {object} fields - `{ <input>: { kind: 'variable', value, variables } }`
 * @param {object} outputs - `{ <componentId>: { <port>: <content> } }`
 * @returns {Promise<object>} `{ <input>: <value> }`, without the undefined ones
 */
async function resolveVariables(context, fields, outputs) {
    const values = {};
    for (const [key, field] of Object.entries(fields || {})) {
        if (field.kind !== 'variable') continue;

        // Send only the outputs the field refers to; the scope can be large.
        const data = {};
        const { _storedScopes: storedScopes } = outputs;
        for (const entry of Object.values(field.variables)) {
            const [, componentId, port] = /^\$\.([^.]+)\.([^.]+)/.exec(entry?.variable || '') || [];
            if (!componentId || outputs[componentId] === undefined) continue;
            // The engine keeps a large output out of the message and leaves only its ID in
            // the scope. A component cannot load it, and an empty value would be a silent error.
            if (outputs[componentId]?.[port] == null && storedScopes?.[componentId]?.[port]) {
                throw new Error(`the output '${port}' of component ${componentId} is too large to be used in a tool`
                    + ` (field '${key}'). The engine does not pass large outputs (over 2 kB by default) to the AI Agent.`);
            }
            data[componentId] = outputs[componentId];
        }

        // The variables can sit anywhere inside the value (a filter is an object), the engine
        // takes one text at a time.
        const resolve = async (value) => {
            if (Array.isArray(value)) return Promise.all(value.map(resolve));
            if (value !== null && typeof value === 'object') {
                const resolved = {};
                for (const [name, item] of Object.entries(value)) resolved[name] = await resolve(item);
                return resolved;
            }
            if (!hasVariable(value)) return value;
            const response = await context.callAppmixer({
                endPoint: '/modifiers/transform',
                method: 'POST',
                body: {
                    template: value,
                    modifiers: field.variables,
                    data: { $: data },
                    context: { flowId: context.flowId }
                }
            });
            if (response?.errors) {
                await context.log({ step: 'component-tool-variable-warning', field: key, errors: response.errors });
            }
            return response?.result;
        };

        const result = await resolve(field.value);
        if (result !== undefined) {
            values[key] = result;
        }
    }
    return values;
}

function forLog(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value, (key, item) => (
        Array.isArray(item) && item.length > MAX_LOGGED_ARRAY ? `[array of ${item.length} items]` : item
    )));
}

/**
 * Call one step with its input built from the outputs known so far.
 */
async function callStep(context, fn, step, args, outputs) {
    const payload = await resolveVariables(context, step.fields, outputs);
    for (const [key, field] of Object.entries(step.fields)) {
        if (field.kind === 'static') payload[key] = field.value;
        if (field.kind === 'model' && args?.[field.parameter] !== undefined) {
            payload[key] = args[field.parameter];
        }
    }
    await context.log({
        step: 'component-tool-chain-call',
        tool: fn.name,
        label: step.label,
        componentId: step.componentId,
        payload: forLog(payload)
    });
    const result = await context.callAppmixer({
        endPoint: '/component/' + step.componentType.replace(/\./g, '/'),
        method: 'POST',
        body: {
            componentId: step.componentId,
            messages: { [step.inPort]: payload },
            ...(Object.keys(step.properties || {}).length ? { properties: step.properties } : {})
        }
    });
    await context.log({ step: 'component-tool-chain-result', tool: fn.name, label: step.label, result: forLog(result) });
    return result;
}

/**
 * Run the chain from the step at `index` on. A component that sends several messages
 * to a port (Find Emails with one email at a time) has them returned by the static
 * call as an array; the next step then runs once per message, the way it would in the
 * running flow, and the results come back as a list.
 *
 * @returns {Promise<*>} output of the last step, or a list of them after a fan-out
 */
async function runFrom(context, fn, args, index, outputs, result) {
    const { _chain: chain } = fn;
    const step = chain[index];
    if (!step) return result;

    // As in a running flow, a step runs only when its source port sent something.
    const source = outputs[step.sourceId];
    const sent = source && typeof source === 'object' ? source[step.sourcePort] : undefined;
    if (sent === undefined) {
        await context.log({
            step: 'component-tool-chain-stopped',
            tool: fn.name,
            before: step.label,
            sourcePort: step.sourcePort
        });
        return result;
    }
    if (!Array.isArray(sent)) {
        let stepResult;
        try {
            stepResult = await callStep(context, fn, step, args, outputs);
        } catch (err) {
            throw new Error(`step "${step.label}": ${err.message}`);
        }
        return runFrom(context, fn, args, index + 1, { ...outputs, [step.componentId]: stepResult }, stepResult);
    }

    const limit = Number(context.config?.AI_AGENT_TOOL_MAX_ITEMS) || MAX_ITEMS;
    const results = [];
    for (const message of sent.slice(0, limit)) {
        const itemOutputs = { ...outputs, [step.sourceId]: { ...source, [step.sourcePort]: message } };
        try {
            const stepResult = await callStep(context, fn, step, args, itemOutputs);
            results.push(await runFrom(
                context, fn, args, index + 1, { ...itemOutputs, [step.componentId]: stepResult }, stepResult
            ));
        } catch (err) {
            // One failed item must not cost the model all the others.
            await context.log({ step: 'component-tool-chain-error', tool: fn.name, label: step.label, error: err.message });
            results.push({ error: `Step "${step.label}" failed: ${err.message}` });
        }
    }
    if (sent.length > limit) {
        await context.log({ step: 'component-tool-chain-truncated', tool: fn.name, label: step.label, items: sent.length, limit });
        results.push({ note: `Only the first ${limit} of ${sent.length} items were processed.` });
    }
    return results;
}

/**
 * Run the steps behind the tool's first component. Never throws: like in tool.js, an
 * error is returned as the tool output so that the model can deal with it.
 *
 * @param {object} context
 * @param {object} toolDef
 * @param {object} args - arguments the model called the tool with
 * @param {*} firstResult - output of the first component
 * @returns {Promise<string>} output of the last step that ran
 */
async function run(context, toolDef, args, firstResult) {
    const fn = toolDef.function;
    const { _componentId: firstComponentId } = fn;
    const outputs = { ...getScope(context), [firstComponentId]: firstResult };

    try {
        const result = await runFrom(context, fn, args, 0, outputs, firstResult);
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    } catch (err) {
        await context.log({ step: 'component-tool-chain-error', tool: fn.name, error: err.message });
        return `Error calling tool ${fn.name}: ${err.message}`;
    }
}

module.exports = {
    extendToolDef,
    getScope,
    hasVariable,
    pickProperties,
    toParameter,
    resolveVariables,
    run
};
