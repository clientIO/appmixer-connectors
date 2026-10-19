'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Get a single quote record by ID.
 */
module.exports = {

    async receive(context) {

        const { quoteId } = context.messages.in.content;

        if (!quoteId) {
            throw new context.CancelError('Quote ID is required!');
        }

        const record = await (new ZohoClient(context)).getRecord('Quotes', quoteId);

        if (!record) {
            throw new context.CancelError(`Quote ${quoteId} was not found.`);
        }

        return context.sendJson(record, 'out');
    }
};
