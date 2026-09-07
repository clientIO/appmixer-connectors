'use strict';

// ─── MCP server communication ─────────────────────────────────────────────────
// Mirrors ai/agent/mcp.js so that MCPGateway and AIAgent talk to MCP servers
// the same way.

async function mcpListTools(context, componentId) {

    const { data } = await context.httpRequest({
        url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=listTools`,
        method: 'POST',
        data: {}
    });
    return data;
}

async function mcpCallTool(context, componentId, toolName, args, correlationId) {

    const { data } = await context.httpRequest({
        url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=callTool`,
        method: 'POST',
        data: {
            name: toolName,
            arguments: args,
            correlationId
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
