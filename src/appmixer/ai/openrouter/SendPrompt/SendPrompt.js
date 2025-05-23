'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { prompt, model } = context.messages.in.content;
        const { data } = await lib.request(context, 'post', '/chat/completions', {
            model: model || 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant.',
                    name: 'system'
                },
                {
                    role: 'user',
                    content: prompt,
                    name: 'user'
                }
            ]
        });

        let answer = '';
        if (data && data.choices) {
            answer = data.choices[0].message.content;
        }

        return context.sendJson({ answer, prompt }, 'out');
    }
};
