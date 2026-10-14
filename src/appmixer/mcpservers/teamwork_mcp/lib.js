'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

module.exports = {
    mcpCall: async (context, env, method, args) => {
        const clientName = `mcp-client:${context.flowId}:${context.componentId}:${Math.random().toString(36).substring(7)}`;
        const client = new Client( {name: clientName, version: "1.0.0" });
        const url = new URL("https://mcp.ai.teamwork.com");

        const transport = new StreamableHTTPClientTransport(
            url,
            {
                requestInit: {
                    headers: {
                        'Authorization': `Bearer ${context.auth.accessToken}`
                    }
                }
            }
        );

        transport.onerror = (err) => {
            context.log({ step: 'error', error: err });
        };

        await client.connect(transport);

        let result;
        try {
            result = await client[method].apply(client, args);
        } finally {
            await client.close();
        }

        return result;
    }
};
