'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { model, text, normalize } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const data = { inputs: text };

        // `normalize` is only understood by sentence-transformers style models, so
        // it is left out entirely unless the user asked for it.
        if (normalize) {
            data.normalize = true;
        }

        // The OpenAI compatible /v1 surface of the router covers chat completions
        // only, so embeddings go through the hf-inference feature-extraction task
        // route. It answers with a bare array, not a wrapper object.
        const response = await lib.makeRequest({
            context,
            method: 'POST',
            baseUrl: lib.ROUTER_BASE_URL,
            path: `/hf-inference/models/${lib.encodeRepoId(model)}/pipeline/feature-extraction`,
            data
        });

        // A single string input yields one vector (number[]); some models nest it
        // one level deeper (number[][] of token vectors). Flatten to a single
        // vector of numbers so downstream components always see the same shape.
        const embedding = toVector(response);

        if (embedding === RAGGED) {
            throw new context.CancelError(
                `Model ${model} returned token vectors of differing lengths, which cannot be pooled `
                + 'into one sentence embedding. Pick a sentence-level feature-extraction model '
                + '(for example a sentence-transformers model).'
            );
        }

        if (!embedding) {
            throw new context.CancelError(
                `Model ${model} did not return a numeric embedding. Pick a feature-extraction model.`
            );
        }

        return context.sendJson({
            model,
            embedding,
            dimensions: embedding.length
        }, 'out');
    }
};

// Returned when the response holds token vectors that cannot be pooled. Silently
// falling back to the first token's vector would emit a semantically wrong embedding
// that looks perfectly valid downstream, so the caller turns this into an error.
const RAGGED = Symbol('ragged');

/**
 * Reduce the variably nested feature-extraction response to one flat vector.
 * Nested responses (per-token vectors) are mean-pooled so the output is always a
 * single sentence-level embedding.
 * @param {*} value
 * @returns {array|null|symbol} array of numbers, null when the shape is unusable,
 *   or RAGGED when nested rows have differing lengths
 */
function toVector(value) {

    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }

    if (value.every(item => typeof item === 'number')) {
        return value;
    }

    const nested = value.map(toVector);
    if (nested.some(row => row === RAGGED)) {
        return RAGGED;
    }

    const rows = nested.filter(Array.isArray);
    if (rows.length === 0) {
        return null;
    }

    const width = rows[0].length;
    if (!rows.every(row => row.length === width)) {
        return RAGGED;
    }

    return rows[0].map((_, column) => {
        const sum = rows.reduce((total, row) => total + row[column], 0);
        return sum / rows.length;
    });
}
