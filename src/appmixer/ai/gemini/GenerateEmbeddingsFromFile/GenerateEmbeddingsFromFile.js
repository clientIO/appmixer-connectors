'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const config = {
            apiKey: context.auth.apiKey,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
        };

        await lib.generateEmbeddingsFromFile(context, config, context.messages.in.content, (out) => {
            return context.sendJson(out, 'out');
        });
    }
};
