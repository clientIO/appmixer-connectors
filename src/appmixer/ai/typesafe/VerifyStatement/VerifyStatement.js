'use strict';

const lib = require('../lib');

const DEFAULT_THRESHOLD = 0.5;

const isEmpty = value => value === undefined || value === null || String(value).trim() === '';

module.exports = {

    async receive(context) {

        const { state, statement, trueCriteria, falseCriteria, threshold, model } = context.messages.in.content;

        const content = lib.getState(context, state);
        if (isEmpty(statement)) {
            throw new context.CancelError('Statement is required!');
        }

        const limit = isEmpty(threshold) ? DEFAULT_THRESHOLD : Number(threshold);
        if (!Number.isFinite(limit) || limit < 0 || limit > 1) {
            throw new context.CancelError('Threshold must be a number between 0 and 1.');
        }

        // https://docs.typesafe.ai/primitives - noul
        const question = { type: 'noul', instructions: statement };
        const criteria = {};
        if (!isEmpty(trueCriteria)) {
            criteria.true = trueCriteria;
        }
        if (!isEmpty(falseCriteria)) {
            criteria.false = falseCriteria;
        }
        if (Object.keys(criteria).length) {
            question.criteria = criteria;
        }

        const { answer, model: resolvedModel, usage } = await lib.askQuestion({
            context,
            model,
            state: content,
            question
        });

        // A noul answer carries only the probability that the statement is true.
        const probability = answer.noul;

        return context.sendJson({
            probability,
            result: typeof probability === 'number' && probability >= limit,
            model: resolvedModel,
            usage: { inputTokens: usage.input_tokens }
        }, 'out');
    }
};
