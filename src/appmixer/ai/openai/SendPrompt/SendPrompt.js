'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const {
            instructions,
            prompt,
            model,
            temperature,
            maxTokens,
            topP,
            frequencyPenalty,
            presencePenalty
        } = context.messages.in.content;
        if (!prompt) {
            throw new context.CancelError('Prompt is required');
        }

        // Only send the sampling parameters the user actually set, otherwise
        // let the model apply its own defaults. Values bound to flow variables
        // arrive as strings, so coerce them; anything non-numeric is dropped.
        const sampling = {};
        Object.entries({
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty
        }).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            const number = Number(value);
            if (!Number.isNaN(number)) {
                sampling[key] = key === 'max_tokens' ? Math.trunc(number) : number;
            }
        });

        const { data } = await lib.request(context, 'post', '/chat/completions', {
            model: model || 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: instructions || 'You are a helpful assistant.',
                    name: 'system'
                },
                {
                    role: 'user',
                    content: prompt,
                    name: 'user'
                }
            ],
            ...sampling
        });

        let answer = '';
        if (data?.choices) {
            answer = data.choices[0].message.content;
        }

        return context.sendJson({ answer, prompt }, 'out');
    }
};
