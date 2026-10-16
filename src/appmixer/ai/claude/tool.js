'use strict';

/**
 * tool.js — "tool" output port: expose any Appmixer action component or MCP server
 * as a tool of the AI Agent.
 *
 * Based on ai/mcptools/tool.js (MCP Gateway), which is why the code below still says
 * "gateway" for the component owning the port. These things differ and have to be kept
 * when syncing the files: tool chains (see toolChain.js), the component label leading
 * the tool description, the component properties sent with the call, and a tool that
 * cannot be loaded failing the start instead of being left out. Components wired to
 * the "tool" port are either:
 *
 *   - Regular action components: called synchronously via context.callAppmixer()
 *     (static component call, no ToolStart/ToolOutput chain, no flow-state polling).
 *   - MCP servers (appmixer.mcpservers.*.MCPServer): tools are enumerated via
 *     mcpListTools and executed via mcpCallTool (see mcp.js).
 *
 * Parameter model (regular action components)
 * ───────────────────────────────────────────
 * The user marks fields the model should fill with the "Model Defined Parameter"
 * output variable of the AI Agent (port "tool", option "modelDefinedParameter").
 * Only those fields become parameters in the tool definition. Fields with a literal
 * user-set value are passed as static properties on every call.
 *
 *
 * A tool can be more than one component: whatever is connected behind the component
 * on the "tool" port runs after it, each step fed from the previous one the way the
 * flow maps it, and the output of the last step is the tool output (toolChain.js).
 */

const crypto = require('crypto');
const shortuuid = require('short-uuid');
const uuid = require('uuid');
const mcp = require('./mcp');
const toolChain = require('./toolChain');

const TOOL_PORT = 'tool';
const TOOL_START_TYPE = 'appmixer.ai.agenttools.ToolStart';
const MAX_TOOL_NAME_LENGTH = 64;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHandlebarsExpression(val) {
    return typeof val === 'string' && /\{\{.*?\}\}/.test(val);
}

/**
 * Tool names are `<componentId>_<name>` and must fit into 64 characters. Component
 * IDs in real flows are UUIDs (36 chars) which would leave very little room for the
 * tool name, so UUIDs are shortened (22 chars). Tool calls are resolved by looking
 * the full name up in the cached definitions, never by parsing the prefix.
 */
function encodeComponentId(componentId) {
    return uuid.validate(componentId) ? shortuuid().fromUUID(componentId) : componentId;
}

function buildToolName(componentId, rawName) {
    const prefix = encodeComponentId(componentId);
    const maxNameLength = Math.max(1, MAX_TOOL_NAME_LENGTH - prefix.length - 1);
    const safeName = rawName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, maxNameLength);
    return `${prefix}_${safeName}`;
}

/**
 * Sanitizing and truncating a name is not injective ("foo-bar" / "foo_bar", or two
 * long names sharing the retained prefix), while receive() resolves a call by the
 * full name — a colliding tool would be unreachable. Every definition of a colliding
 * group gets a suffix derived from its component and original tool name, so the
 * public name does not depend on the order the tools were listed in. Definitions that
 * still collide (an MCP server listing the same name twice) are dropped.
 *
 * @returns {{ defs: Array, dropped: Array<string> }}
 */
function disambiguateToolNames(defs) {
    const counts = new Map();
    for (const def of defs) {
        counts.set(def.function.name, (counts.get(def.function.name) || 0) + 1);
    }

    const taken = new Set();
    const unique = [];
    const dropped = [];
    for (const def of defs) {
        const fn = def.function;
        const { _componentId: componentId, _mcpToolName: mcpToolName } = fn;
        if (counts.get(fn.name) > 1) {
            const hash = crypto.createHash('sha1')
                .update(`${componentId}:${mcpToolName || ''}`)
                .digest('hex')
                .slice(0, 8);
            fn.name = `${fn.name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
        }
        if (taken.has(fn.name)) {
            dropped.push(mcpToolName || fn.name);
            continue;
        }
        taken.add(fn.name);
        unique.push(def);
    }
    return { defs: unique, dropped };
}

/**
 * Strip the internal `_*` execution metadata so that only the public
 * function-calling definition (type, function.name/description/parameters)
 * leaves the component (gateway registry, MCP clients).
 */
function toPublicToolDef(toolDef) {
    const fn = {};
    for (const [key, value] of Object.entries(toolDef.function)) {
        if (!key.startsWith('_')) fn[key] = value;
    }
    return { type: toolDef.type, function: fn };
}

// ─── Manifest fetching ────────────────────────────────────────────────────────

/**
 * Fetch the component manifest for a given fully-qualified component type.
 * Uses the /components?selector=TYPE endpoint. Returns the first (and normally
 * only) entry in the result array.
 */
async function fetchManifest(context, componentType) {
    const raw = await context.callAppmixer({
        endPoint: `/components?selector=${encodeURIComponent(componentType)}`,
        method: 'GET'
    });
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed[0] : parsed;
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Find the input port of `component` that is wired to my "tool" output port.
 */
function findToolInPort(component, gatewayComponentId) {
    const sources = component.source || {};
    for (const [port, src] of Object.entries(sources)) {
        // A stored flow may hold a single port as a string, and 'tools'.includes('tool')
        // would take a component on the 'tools' port for one of ours.
        if ([].concat(src?.[gatewayComponentId] || []).includes(TOOL_PORT)) {
            return port;
        }
    }
    return null;
}

/**
 * Fetch manifests for all components wired to the gateway's "tool" port and cache
 * them to state. Called from MCPGateway.start().
 *
 * MCP servers have no static manifest — they get a sentinel { _isMCP: true } entry
 * so buildDefsFromManifests knows to enumerate their tools dynamically.
 */
async function fetchAndCacheManifests(context) {
    const flowDescriptor = context.flowDescriptor;
    const gatewayComponentId = context.componentId;
    const manifests = {};

    Object.keys(flowDescriptor).forEach((componentId) => {
        if (findToolInPort(flowDescriptor[componentId], gatewayComponentId)) {
            manifests[componentId] = null;
        }
    });

    for (const componentId of Object.keys(manifests)) {
        if (mcp.isMCPserver(context, componentId)) {
            manifests[componentId] = { _isMCP: true };
            continue;
        }
        const otherType = flowDescriptor[componentId].type;
        try {
            manifests[componentId] = await fetchManifest(context, otherType);
        } catch (err) {
            await context.log({
                step: 'component-tool-manifest-error',
                componentId,
                type: otherType,
                error: err.message
            });
        }
    }

    await context.stateSet('componentToolManifests', manifests);
    return manifests;
}

/**
 * Build tool definitions from cached manifests + current flowDescriptor.
 */
async function buildDefsFromManifests(context, manifests) {
    const flowDescriptor = context.flowDescriptor;
    const gatewayComponentId = context.componentId;
    const defs = [];

    for (const componentId of Object.keys(manifests)) {
        const manifest = manifests[componentId];
        const { _isMCP: isMCP } = manifest || {};

        if (isMCP) {
            const mcpDefs = await buildMCPToolDefs(context, componentId);
            defs.push(...mcpDefs);
            continue;
        }

        const component = flowDescriptor[componentId];
        if (!component) continue;

        const inPortName = findToolInPort(component, gatewayComponentId);
        if (!inPortName) continue;

        if (component.type === TOOL_START_TYPE) {
            throw new context.CancelError(`Component ${componentId} is a 'ToolStart' connected to the
                '${TOOL_PORT}' port of the AI Agent. A 'ToolStart' chain belongs to the 'tools' port;
                on the '${TOOL_PORT}' port connect the component that does the work directly.`);
        }

        // The tools are cached for the whole run of the flow, so a tool that cannot be loaded
        // now would be missing until the next start. Fail instead, as the 'mcp' port does.
        let resolvedManifest = manifest;
        if (!resolvedManifest) {
            try {
                resolvedManifest = await fetchManifest(context, component.type);
            } catch (err) {
                throw new Error(`The tool ${component.label || componentId} (${component.type}) could not be loaded: `
                    + err.message);
            }
        }
        if (!resolvedManifest) {
            throw new Error(`The tool ${component.label || componentId} could not be loaded: `
                + `component ${component.type} was not found.`);
        }

        const def = buildComponentToolDef(componentId, component, resolvedManifest, inPortName, gatewayComponentId);
        // Whatever is connected behind the component belongs to the same tool.
        await toolChain.extendToolDef(context, def, fetchManifest);
        const { _aiFields: aiFields, _userStaticValues: userStaticValues } = def.function;

        await context.log({
            step: 'component-tool-manifest-inspect',
            componentId,
            manifestName: resolvedManifest.name,
            manifestLabel: resolvedManifest.label,
            inPortNames: (resolvedManifest.inPorts || []).map(p => p.name),
            aiFields,
            userStaticValues
        });
        defs.push(def);
    }

    const { defs: uniqueDefs, dropped } = disambiguateToolNames(defs);
    if (dropped.length) {
        await context.log({ step: 'component-tool-duplicate-names-dropped', dropped });
    }
    return uniqueDefs;
}

/**
 * Build tool defs for a single MCP server by listing its tools.
 * One MCP server can expose N tools — each becomes a separate tool def.
 */
async function buildMCPToolDefs(context, componentId) {
    try {
        const mcpTools = await mcp.mcpListTools(context, componentId);
        await context.log({ step: 'mcp-tool-port-list-tools', componentId, tools: mcpTools });

        return (mcpTools || []).map((mcpTool) => {
            const parameters = mcpTool.inputSchema
                ? { ...mcpTool.inputSchema }
                : { type: 'object', properties: {} };
            if (parameters.type === 'object' && !parameters.properties) {
                parameters.properties = {};
            }
            return {
                type: 'function',
                function: {
                    name: buildToolName(componentId, mcpTool.name),
                    description: mcpTool.description || mcpTool.name,
                    parameters,
                    _isMCP: true,
                    _componentId: componentId,
                    _mcpToolName: mcpTool.name
                }
            };
        });
    } catch (err) {
        await context.log({ step: 'mcp-tool-port-list-tools-error', componentId, error: err.message });
        throw new Error(`The MCP server ${componentId} did not list its tools: ${err.message}`);
    }
}

/**
 * Discover everything wired to the "tool" port, build the tool definitions and
 * cache them to state under `componentTools`. Called from MCPGateway.start().
 */
async function collectComponentTools(context) {
    const manifests = await fetchAndCacheManifests(context);
    const defs = await buildDefsFromManifests(context, manifests);
    await context.log({ step: 'component-tools', count: defs.length });
    await context.stateSet('componentTools', defs);
    return defs;
}

/**
 * Return the cached tool definitions (built in start()).
 */
async function getComponentToolDefs(context) {
    return (await context.stateGet('componentTools')) || [];
}

// ─── Tool definition builder (regular action components) ──────────────────────

function buildComponentToolDef(componentId, componentDescriptor, manifest, connectedInPortName, gatewayComponentId) {
    const aiFields = new Set();
    const userStaticValues = {};

    // Field configuration lives in config.transform[inPortName][gatewayComponentId][TOOL_PORT]
    // (not config.properties — that's empty for tool-port components).
    const transform = componentDescriptor.config?.transform?.[connectedInPortName]?.[gatewayComponentId]?.[TOOL_PORT];
    if (transform) {
        const modifiers = transform.modifiers || {};
        const lambda = transform.lambda || {};

        // AI fields: modifier entries whose variable references modelDefinedParameter.
        for (const [key, modifier] of Object.entries(modifiers)) {
            if (!modifier || typeof modifier !== 'object') continue;
            for (const entry of Object.values(modifier)) {
                if (entry?.variable && entry.variable.includes('modelDefinedParameter')) {
                    aiFields.add(key);
                    break;
                }
            }
        }

        // Static values: lambda entries that are literal (not Handlebars) and not AI-filled.
        for (const [key, val] of Object.entries(lambda)) {
            if (aiFields.has(key)) continue;
            if (val === null || val === undefined || val === '') continue;
            // A value with flow variables, also when they sit inside an object, is resolved
            // on every call (toolChain.js).
            if (!isHandlebarsExpression(String(val)) && !toolChain.hasVariable(val)) {
                userStaticValues[key] = val;
            }
        }
    }

    const inPortDef =
        (manifest.inPorts || []).find(p => p.name === connectedInPortName) ||
        (manifest.inPorts || [])[0];

    const inPortSchemaProps = inPortDef?.schema?.properties || {};
    const inPortInspector = inPortDef?.inspector?.inputs || {};
    const inPortRequired = new Set(inPortDef?.schema?.required || []);

    const propSchemaProps = manifest.properties?.schema?.properties || {};
    const propInspector = manifest.properties?.inspector?.inputs || {};
    const propRequired = new Set(manifest.properties?.schema?.required || []);

    const parameters = { type: 'object', properties: {}, required: [] };

    for (const [key, schemaProp] of Object.entries(inPortSchemaProps)) {
        if (!aiFields.has(key)) continue;
        parameters.properties[key] = toolChain.toParameter(schemaProp, inPortInspector[key], key);
        if (inPortRequired.has(key)) parameters.required.push(key);
    }

    for (const [key, schemaProp] of Object.entries(propSchemaProps)) {
        if (!aiFields.has(key)) continue;
        if (key in parameters.properties) continue;
        parameters.properties[key] = toolChain.toParameter(schemaProp, propInspector[key], key);
        if (propRequired.has(key)) parameters.required.push(key);
    }

    if (!parameters.required.length) delete parameters.required;

    // Prefer the label the user gave the component instance in the flow: several
    // instances of the same component type (e.g. two MockValue tools) must be
    // distinguishable by the model.
    const rawLabel = componentDescriptor.label || manifest.label || manifest.name
        || componentDescriptor.type.split('.').pop();

    // A manifest description says what the component does ("Query Pinecone for vectors."),
    // not what this instance is for. The label the user gave it leads the description, so
    // the model can tell e.g. which data a generic query component holds.
    const description = [componentDescriptor.label, manifest.description].filter(Boolean).join(' - ') || rawLabel;

    return {
        type: 'function',
        function: {
            name: buildToolName(componentId, rawLabel),
            description,
            ...(Object.keys(parameters.properties).length ? { parameters } : {}),
            _componentTool: true,
            _componentId: componentId,
            _componentType: manifest.name || componentDescriptor.type,
            _inPort: inPortDef?.name || 'in',
            _userStaticValues: userStaticValues,
            _aiFields: [...aiFields],
            _properties: toolChain.pickProperties(componentDescriptor, manifest)
        }
    };
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Execute one tool call. Never throws — errors are returned as a string so that
 * the caller (webhook handler) can hand them back to the MCP client instead of
 * triggering a component retry.
 *
 * @returns {Promise<string>} tool output, always a string.
 */
async function executeComponentTool(context, toolDef, args, { correlationId } = {}) {
    const { name: fullToolName, _isMCP, _componentId, _mcpToolName,
        _componentType, _inPort, _userStaticValues, _aiFields, _variableFields, _chain,
        _properties } = toolDef.function;
    const displayName = _isMCP ? _mcpToolName : fullToolName;

    if (_isMCP) {
        try {
            const output = await mcp.mcpCallTool(context, _componentId, _mcpToolName, args, correlationId);
            await context.log({ step: 'mcp-tool-call-result', displayName, output });
            return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        } catch (err) {
            await context.log({ step: 'mcp-tool-call-error', displayName, error: err.message });
            return `Error calling tool ${displayName}: ${err.message}`;
        }
    }

    // Regular action component: merge model args + static values and call it statically.
    // `args` come from the webhook caller, so only the fields the user marked as
    // "Model Defined Parameter" are taken from them, and the static values are applied
    // last — a caller can never override a value configured on the tool.
    const endPoint = '/component/' + _componentType.replace(/\./g, '/');
    const modelArgs = {};
    for (const key of _aiFields || []) {
        if (args && args[key] !== undefined) modelArgs[key] = args[key];
    }
    // Fields mapped to variables of the components in front of the agent.
    let variableValues;
    try {
        variableValues = await toolChain.resolveVariables(context, _variableFields, toolChain.getScope(context));
    } catch (err) {
        await context.log({ step: 'component-tool-call-error', displayName, endPoint, error: err.message });
        return `Error calling tool ${displayName}: ${err.message}`;
    }
    const messagePayload = { ...variableValues, ...modelArgs, ..._userStaticValues };
    await context.log({
        step: 'component-tool-call',
        displayName,
        componentId: _componentId,
        inPort: _inPort,
        aiArgs: args,
        staticValues: _userStaticValues,
        mergedPayload: messagePayload
    });
    try {
        const result = await context.callAppmixer({
            endPoint,
            method: 'POST',
            body: {
                componentId: _componentId,
                messages: { [_inPort]: messagePayload },
                ...(Object.keys(_properties || {}).length ? { properties: _properties } : {})
            }
        });
        await context.log({ step: 'component-tool-result', displayName, result });
        if (_chain?.length) {
            return toolChain.run(context, toolDef, args, result);
        }
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    } catch (err) {
        await context.log({ step: 'component-tool-call-error', displayName, endPoint, error: err.message });
        return `Error calling tool ${displayName}: ${err.message}`;
    }
}

module.exports = {
    TOOL_PORT,
    collectComponentTools,
    getComponentToolDefs,
    executeComponentTool,
    toPublicToolDef
};
