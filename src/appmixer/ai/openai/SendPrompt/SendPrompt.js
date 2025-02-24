'use strict';

module.exports = {

    receive: async function(context) {

        const { prompt, model } = context.messages.in.content;
        const apiKey = context.auth.apiKey;

        const url = 'https://api.openai.com/v1/chat/completions';
        const { data } = await context.httpRequest.post(url, {
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
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        let answer = '';

        if (data && data.choices) {
            answer = data.choices[0].message.content;
        }

        return context.sendJson({ answer }, 'out');
    }
};
