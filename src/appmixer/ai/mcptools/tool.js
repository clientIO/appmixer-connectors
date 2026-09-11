'use strict';

/**
 * tool.js — "tool" output port: expose any Appmixer action component or MCP server
 * as a tool of the MCP Gateway.
 *
 * Same mechanism as ai/agent/tool.js (AI Agent v2). Components wired to the "tool"
 * port are either:
 *
 *   - Regular action components: called synchronously via context.callAppmixer()
 *     (static component call, no ToolStart/ToolOutput chain, no flow-state polling).
 *   - MCP servers (appmixer.mcpservers.*.MCPServer): tools are enumerated via
 *     mcpListTools and executed via mcpCallTool (see mcp.js).
 *
 * Parameter model (regular action components)
 * ───────────────────────────────────────────
 * The user marks fields the model should fill with the "Model Defined Parameter"
 * output variable of the MCP Gateway (port "tool", option "modelDefinedParameter").
 * Only those fields become parameters in the tool definition. Fields with a literal
 * user-set value are passed as static properties on every call.
 */

const shortuuid = require('short-uuid');
const uuid = require('uuid');
const mcp = require('./mcp');

const TOOL_PORT = 'tool';
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
        if (src[gatewayComponentId] && src[gatewayComponentId].includes(TOOL_PORT)) {
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

        let resolvedManifest = manifest;
        if (!resolvedManifest) {
            try {
                resolvedManifest = await fetchManifest(context, component.type);
            } catch (err) {
                await context.log({
                    step: 'component-tool-manifest-error',
                    componentId,
                    type: component.type,
                    error: err.message
                });
                continue;
            }
        }
        if (!resolvedManifest) continue;

        const def = buildComponentToolDef(componentId, component, resolvedManifest, inPortName, gatewayComponentId);
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

    return defs;
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
        return [];
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
            if (!isHandlebarsExpression(String(val))) {
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
        const inp = inPortInspector[key] || {};
        parameters.properties[key] = {
            type: schemaProp.type || 'string',
            description: [inp.label, inp.tooltip].filter(Boolean).join(' — ') || key
        };
        if (inPortRequired.has(key)) parameters.required.push(key);
    }

    for (const [key, schemaProp] of Object.entries(propSchemaProps)) {
        if (!aiFields.has(key)) continue;
        if (key in parameters.properties) continue;
        const inp = propInspector[key] || {};
        parameters.properties[key] = {
            type: schemaProp.type || 'string',
            description: [inp.label, inp.tooltip].filter(Boolean).join(' — ') || key
        };
        if (propRequired.has(key)) parameters.required.push(key);
    }

    if (!parameters.required.length) delete parameters.required;

    // Prefer the label the user gave the component instance in the flow: several
    // instances of the same component type (e.g. two MockValue tools) must be
    // distinguishable by the model.
    const rawLabel = componentDescriptor.label || manifest.label || manifest.name
        || componentDescriptor.type.split('.').pop();

    return {
        type: 'function',
        function: {
            name: buildToolName(componentId, rawLabel),
            description: manifest.description || rawLabel,
            ...(Object.keys(parameters.properties).length ? { parameters } : {}),
            _componentTool: true,
            _componentId: componentId,
            _componentType: manifest.name || componentDescriptor.type,
            _inPort: inPortDef?.name || 'in',
            _userStaticValues: userStaticValues,
            _aiFields: [...aiFields]
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
        _componentType, _inPort, _userStaticValues } = toolDef.function;
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

    // Regular action component: merge static + model args and call it statically.
    const endPoint = '/component/' + _componentType.replace(/\./g, '/');
    const messagePayload = { ..._userStaticValues, ...args };
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
                messages: { [_inPort]: messagePayload }
            }
        });
        await context.log({ step: 'component-tool-result', displayName, result });
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
