'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { model, text, truncation } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const data = { inputs: text };

        if (truncation) {
            data.parameters = { truncation };
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            baseUrl: lib.ROUTER_BASE_URL,
            path: `/hf-inference/models/${lib.encodeRepoId(model)}`,
            data
        });

        // Summarization answers with an array holding one result per input, so a
        // single string input comes back as [{ summary_text }].
        const result = Array.isArray(response) ? response[0] : response;
        const summary = result && result.summary_text;

        if (!summary) {
            throw new context.CancelError(
                `Model ${model} did not return a summary. Pick a summarization model.`
            );
        }

        return context.sendJson({
            model,
            summary,
            inputLength: String(text).length,
            summaryLength: summary.length
        }, 'out');
    }
};
