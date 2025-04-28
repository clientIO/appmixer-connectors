'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const config = {
            apiKey: context.auth.apiKey,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
        };
        const answer = await lib.sendPrompt(config, context.messages.in.content);
        return context.sendJson({ answer, prompt: context.messages.in.content.prompt }, 'out');
    }
};
