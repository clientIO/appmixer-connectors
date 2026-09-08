'use strict';

const { createClient, parseToolResult } = require('../../mcp-commons');

module.exports = {

    async receive(context) {

        const { toolName } = context.properties;
        const input = context.messages.in.content;

        // Remove toolName from input if accidentally passed through
        const args = { ...input };
        delete args.toolName;

        // Convert string representations of arrays/objects back to their types
        // (Appmixer inputs may stringify complex types)
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object') {
                        args[key] = parsed;
                    }
                } catch (e) {
                    // Keep as string
                }
            }
        }

        // Remove empty/undefined values
        for (const key of Object.keys(args)) {
            if (args[key] === undefined || args[key] === null || args[key] === '') {
                delete args[key];
            }
        }

        const client = createClient(context);

        // Initialize session
        await client.initialize(context.httpRequest.bind(context));

        // Call the selected tool
        const result = await client.callTool(toolName, args, context.httpRequest.bind(context));

        // Parse the MCP result into a usable format
        const parsed = parseToolResult(result);

        return context.sendJson({
            toolName,
            text: parsed.text,
            json: parsed.json,
            isError: parsed.isError,
            raw: parsed.raw
        }, 'out');
    }
};
