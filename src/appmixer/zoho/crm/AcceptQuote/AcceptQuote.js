'use strict';
const ZohoClient = require('../../ZohoClient');

const DEFAULT_ACCEPTED_STAGE = 'Confirmed';

/**
 * Accept a quote by moving it to the accepted quote stage.
 */
module.exports = {

    async receive(context) {

        const { quoteId, quoteStage } = context.messages.in.content;

        if (!quoteId) {
            throw new context.CancelError('Quote ID is required!');
        }

        const stage = quoteStage || DEFAULT_ACCEPTED_STAGE;
        const client = new ZohoClient(context);
        const { details } = await client.executeRecordsRequest('PUT', 'Quotes', [{ id: quoteId, Quote_Stage: stage }]);

        return context.sendJson({
            id: details.id,
            Quote_Stage: stage,
            Modified_Time: details.Modified_Time
        }, 'out');
    }
};
