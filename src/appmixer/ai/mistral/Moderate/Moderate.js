'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { text, model } = context.messages.in.content;

        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        // https://docs.mistral.ai/api/#tag/classifiers
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/moderations`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data: {
                model: model || 'mistral-moderation-latest',
                input: text
            }
        });

        const result = data?.results?.[0] || {};

        const outputData = {
            id: data?.id,
            model: data?.model,
            categories: result.categories || {},
            categoryScores: result.category_scores || {},
            flagged: Object.values(result.categories || {}).some(Boolean)
        };

        return context.sendJson(outputData, 'out');
    }
};
