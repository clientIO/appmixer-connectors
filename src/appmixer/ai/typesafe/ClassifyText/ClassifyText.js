'use strict';

const lib = require('../lib');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 255;

module.exports = {

    async receive(context) {

        const { state, instructions, options, model } = context.messages.in.content;

        const content = lib.getState(context, state);
        if (!instructions) {
            throw new context.CancelError('What to decide is required!');
        }

        const criteria = {};
        lib.getRows(context, options, 'Options').forEach(row => {
            const key = row.key === undefined || row.key === null ? '' : String(row.key).trim();
            if (!key) {
                throw new context.CancelError('Every option needs a key.');
            }
            if (Object.prototype.hasOwnProperty.call(criteria, key)) {
                throw new context.CancelError(`Duplicate option key '${key}'. Option keys must be unique.`);
            }
            const description = row.description;
            criteria[key] = description === undefined || description === null || String(description).trim() === ''
                ? null
                : description;
        });

        const count = Object.keys(criteria).length;
        if (count < MIN_OPTIONS || count > MAX_OPTIONS) {
            throw new context.CancelError(`Options must contain ${MIN_OPTIONS} to ${MAX_OPTIONS} rows, got ${count}.`);
        }

        // https://docs.typesafe.ai/primitives - choice
        const { answer, model: resolvedModel, usage } = await lib.askQuestion({
            context,
            model,
            state: content,
            question: { type: 'choice', instructions, criteria }
        });

        const probabilities = answer.probabilities || {};
        const ranking = Object.keys(probabilities)
            .map(option => ({ option, probability: probabilities[option] }))
            .sort((a, b) => b.probability - a.probability);

        return context.sendJson({
            choice: answer.choice,
            confidence: answer.confidence,
            probabilities,
            ranking,
            model: resolvedModel,
            usage: { inputTokens: usage.input_tokens }
        }, 'out');
    }
};
