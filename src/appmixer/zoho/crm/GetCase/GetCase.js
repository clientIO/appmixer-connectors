'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Get a single case record by ID.
 */
module.exports = {

    async receive(context) {

        const { caseId } = context.messages.in.content;

        if (!caseId) {
            throw new context.CancelError('Case ID is required!');
        }

        const record = await (new ZohoClient(context)).getRecord('Cases', caseId);

        if (!record) {
            throw new context.CancelError(`Case ${caseId} was not found.`);
        }

        return context.sendJson(record, 'out');
    }
};
