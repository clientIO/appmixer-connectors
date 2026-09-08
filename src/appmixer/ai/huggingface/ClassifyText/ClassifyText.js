'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { model, text, topK } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const data = { inputs: text };

        if (topK) {
            data.parameters = { top_k: Number(topK) };
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            baseUrl: lib.ROUTER_BASE_URL,
            path: `/hf-inference/models/${lib.encodeRepoId(model)}`,
            data
        });

        // Text classification answers with one nested array per input, so a single
        // string input comes back as [[{ label, score }, ...]]. Unwrap that level.
        const first = Array.isArray(response) ? response[0] : null;
        const labels = Array.isArray(first) ? first : (Array.isArray(response) ? response : []);

        if (labels.length === 0) {
            throw new context.CancelError(
                `Model ${model} did not return any labels. Pick a text-classification model.`
            );
        }

        const sorted = [...labels].sort((a, b) => (b.score || 0) - (a.score || 0));

        return context.sendJson({
            model,
            label: sorted[0].label,
            score: sorted[0].score,
            labels: sorted
        }, 'out');
    }
};
