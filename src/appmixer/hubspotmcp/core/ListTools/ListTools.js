'use strict';

const { createClient, toolsToSelectArray, toolInputToInspector } = require('../../mcp-commons');

module.exports = {

    async receive(context) {

        const client = createClient(context);

        // Initialize MCP session first
        await client.initialize(context.httpRequest.bind(context));

        // Fetch all tools
        const tools = await client.listAllTools(context.httpRequest.bind(context));

        return context.sendJson(tools, 'out');
    },

    /**
     * Transform: tools array → select dropdown options.
     * Referenced from CallTool component.json as source transform.
     */
    toolsToSelectArray,

    /**
     * Transform: tools array + selected toolName → dynamic Appmixer inspector.
     * This generates the input fields for the selected MCP tool.
     * Referenced from CallTool component.json inPorts source transform.
     */
    toolInputToInspector
};
