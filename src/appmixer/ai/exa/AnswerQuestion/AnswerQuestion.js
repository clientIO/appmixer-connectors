'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { query, includeText } = context.messages.in.content;

        if (!query) {
            throw new context.CancelError('Question is required!');
        }

        const data = { query };

        if (includeText) {
            data.text = true;
        }

        const response = await lib.makeRequest({ context, path: '/answer', data });
        const citations = (response && response.citations) || [];

        // `answer` is a string unless an output schema was requested, which this
        // component does not expose — stringify defensively so the out port always
        // matches its declared type.
        const answer = response && typeof response.answer === 'object'
            ? JSON.stringify(response.answer)
            : (response && response.answer) || '';

        return context.sendJson({
            requestId: response && response.requestId,
            answer,
            citations,
            citationsCount: citations.length,
            costDollars: (response && response.costDollars && response.costDollars.total) || 0
        }, 'out');
    }
};
