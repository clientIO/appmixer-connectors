'use strict';

// ─── MCP server communication ─────────────────────────────────────────────────

async function mcpListTools(context, componentId) {

    const { data } = await context.httpRequest({
        url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=listTools`,
        method: 'POST',
        data: {}
    });
    return data;
}

async function mcpCallTool(context, componentId, toolName, args) {

    const { data } = await context.httpRequest({
        url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=callTool`,
        method: 'POST',
        data: {
            name: toolName,
            arguments: args,
            correlationId: context.messages?.in?.correlationId
        }
    });
    return data;
}

function isMCPserver(context, componentId) {

    const component = context.flowDescriptor[componentId];
    if (!component) return false;
    const category = component.type.split('.').slice(0, 2).join('.');
    const type = component.type.split('.').at(-1);
    return category === 'appmixer.mcpservers' && type === 'MCPServer';
}

module.exports = {
    mcpListTools,
    mcpCallTool,
    isMCPserver
};
