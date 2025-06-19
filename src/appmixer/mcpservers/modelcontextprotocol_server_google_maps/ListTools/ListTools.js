'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const result = await lib.mcpCall(context, context.auth, 'listTools', []);
        return context.sendJson(result, 'out');
    },

    toolsToSelectArray: async function(out) {

        return (out.tools || []).map(tool => ({ label: tool.name, value: tool.name }));
    }
};
