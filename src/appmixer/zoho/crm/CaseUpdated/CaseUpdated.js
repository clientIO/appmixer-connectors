'use strict';
const ZohoNotifiable = require('../../ZohoNotifiable');

class CaseUpdated extends ZohoNotifiable {

    async receive(context) {

        const { ids } = context.messages.webhook.content.data;
        const records = await this.makeZohoClient(context).getRecords('Cases', {
            params: { ids: ids.join(',') }
        });

        for (const record of records) {
            await context.sendJson(record, 'out');
        }
    }

    async test(context) {

        const record = await this.makeZohoClient(context).getLatestRecord('Cases');

        if (!record) {
            throw new context.CancelError('No cases found to use as test data.');
        }

        return context.sendJson(record, 'out');
    }
}

const events = [
    'Cases.edit'
];

/**
 * Component which triggers whenever a case is updated.
 */
module.exports = new CaseUpdated(events);
