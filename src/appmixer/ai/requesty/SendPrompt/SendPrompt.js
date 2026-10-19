'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            model,
            instructions,
            prompt,
            temperature,
            maxTokens,
            topP,
            frequencyPenalty,
            presencePenalty
        } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }

        const messages = [];
        if (instructions) {
            messages.push({ role: 'system', content: instructions });
        }
        messages.push({ role: 'user', content: prompt });

        const data = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty
        };

        // Remove undefined optional parameters.
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        const response = await lib.request(context, 'POST', '/chat/completions', data);

        const choice = response.choices?.[0];

        return context.sendJson({
            answer: choice?.message?.content ?? '',
            prompt,
            finishReason: choice?.finish_reason,
            id: response.id,
            model: response.model,
            created: response.created,
            usage: response.usage
        }, 'out');
    }
};
