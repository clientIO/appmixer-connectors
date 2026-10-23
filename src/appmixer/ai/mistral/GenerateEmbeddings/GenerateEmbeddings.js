'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { text, model } = context.messages.in.content;

        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        // https://docs.mistral.ai/api/#tag/embeddings
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/embeddings`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data: {
                model: model || 'mistral-embed',
                input: text
            }
        });

        const outputData = {
            embedding: data?.data?.[0]?.embedding || [],
            model: data?.model,
            promptTokens: data?.usage?.prompt_tokens,
            totalTokens: data?.usage?.total_tokens
        };

        return context.sendJson(outputData, 'out');
    }
};
