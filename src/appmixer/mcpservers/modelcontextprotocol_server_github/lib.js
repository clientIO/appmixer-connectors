'use strict';

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const pidusage = require('pidusage');

const SERVER_SCRIPT_PATH = __dirname + '/node_modules/@modelcontextprotocol/server-github/dist/index.js';
const SERVER_SCRIPT_ARGS = '';

module.exports = {

    mcpCall: async (context, env, method, args) => {

        const clientName = `mcp-client:${context.flowId}:${context.componentId}:${Math.random().toString(36).substring(7)}`;

        const processArgs = [SERVER_SCRIPT_PATH];
        if (SERVER_SCRIPT_ARGS) {
            processArgs.push(SERVER_SCRIPT_ARGS);
        }

        const client = new Client({ name: clientName, version: '1.0.0' });
        const params = {
            command: process.execPath,  // node
            args: processArgs,
            env
        };

        let startTime;
        if (context.config.DEBUG === 'true') {
            await context.log({ step: 'connecting-mcp-client', params, clientName });
            startTime = new Date;
        }
        const transport = new StdioClientTransport(params);
        await client.connect(transport);

        let result;
        try {
            if (context.config.DEBUG === 'true') {
                /* eslint-disable no-underscore-dangle */
                const childProcess = transport._process;
                /* eslint-enable no-underscore-dangle */
                const time = (new Date) - startTime;
                const processUage = JSON.stringify(await pidusage(childProcess.pid));
                await context.log({ step: 'connected-mcp-client', params, clientName, time, processUage });
                await context.log({ step: 'calling-mcp-client', method, args, clientName });
            }

            result = await client[method].apply(client, args);

            if (context.config.DEBUG === 'true') {
                await context.log({ step: 'called-mcp-client', result, clientName });
                /* eslint-disable no-underscore-dangle */
                const childProcess = transport._process;
                /* eslint-enable no-underscore-dangle */
                const processUsage = JSON.stringify(await pidusage(childProcess.pid));
                await context.log({ step: 'closing-mcp-client', clientName, processUsage });
                startTime = new Date;
            }
        } finally {
            await client.close();
        }

        if (context.config.DEBUG === 'true') {
            await context.log({ step: 'closed-mcp-client', clientName, time: (new Date) - startTime });
        }

        return result;
    }
};
