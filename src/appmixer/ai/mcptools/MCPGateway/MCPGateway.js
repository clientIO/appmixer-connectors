'use strict';

const uuid = require('uuid');
const componentTool = require('../tool');

/**
 * MCP Gateway.
 *
 * Exposes everything wired to its "tool" output port (regular action components and
 * MCP servers) as tools of the Appmixer MCP Server. On start the tool definitions are
 * built (see ../tool.js) and registered to the per-user gateway registry; the Appmixer
 * MCP Server then calls the gateway webhook with `{ data: { function: { name, arguments } } }`
 * for every tool call and receives the tool output as the HTTP response.
 */
module.exports = {

    start: async function(context) {

        const toolDefs = await componentTool.collectComponentTools(context);
        // Only the public function-calling definition leaves the component; the
        // execution metadata (_componentId, _inPort, ...) stays in component state.
        const tools = toolDefs.map(componentTool.toPublicToolDef);
        await context.log({ step: 'tools', tools });
        await context.stateSet('tools', tools);

        const webhook = context.getWebhookUrl();
        await context.service.stateAddToSet(`mcpgateways:user:${context.userId}`, {
            flowId: context.flowId,
            componentId: context.componentId,
            tools,
            webhook
        });
        await context.callAppmixer({
            endPoint: '/plugins/appmixer/ai/mcptools/gateways',
            method: 'POST',
            body: {}
        });

        // Announce the registered gateway once per flow start. The tool call URL is
        // only known at runtime, so this is what lets the rest of the flow reach it:
        // publish it (chat, email, a data store) or call it, as the E2E flow does.
        return context.sendJson({
            webhook,
            componentId: context.componentId,
            flowId: context.flowId,
            tools
        }, 'out');
    },

    stop: async function(context) {

        const tools = await context.stateGet('tools');
        await context.service.stateRemoveFromSet(`mcpgateways:user:${context.userId}`, {
            flowId: context.flowId,
            componentId: context.componentId,
            tools,
            webhook: context.getWebhookUrl()
        });
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/ai/mcptools/gateways/${context.componentId}?flowId=${encodeURIComponent(context.flowId)}`,
            method: 'DELETE'
        });
    },

    receive: async function(context) {

        if (!context.messages.webhook) {
            return;
        }

        const req = context.messages.webhook.content;
        const fn = req?.data?.function;
        if (!fn?.name) {
            return context.response('Invalid request: missing function name', 400);
        }

        let args = fn.arguments;
        if (typeof args === 'string') {
            try {
                args = args.trim() ? JSON.parse(args) : {};
            } catch (err) {
                return context.response(`Invalid request: malformed function arguments: ${err.message}`, 400);
            }
        }
        if (args === undefined || args === null) {
            args = {};
        }
        if (typeof args !== 'object' || Array.isArray(args)) {
            return context.response('Invalid request: function arguments must be a JSON object', 400);
        }

        // Tool calls are resolved against the definitions built in start() — the
        // function name is an opaque identifier for the MCP client.
        const toolDefs = await componentTool.getComponentToolDefs(context);
        const toolDef = toolDefs.find(def => def.function.name === fn.name);
        if (!toolDef) {
            await context.log({ step: 'unknown-tool', name: fn.name });
            return context.response(`Unknown tool: ${fn.name}`, 404);
        }

        const correlationId = context.messages.webhook.correlationId || uuid.v4();
        const output = await componentTool.executeComponentTool(context, toolDef, args, { correlationId });
        return context.response(output, 200);
    }
};
