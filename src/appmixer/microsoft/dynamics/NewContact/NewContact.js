'use strict';

const { startPolling, pollEntity, fetchLatestRecord } = require('../dynamics-commons');

const ENTITY = { logicalName: 'contact', entitySet: 'contacts', dateField: 'createdon' };

module.exports = {

    async start(context) {

        // Baseline the polling window so only records changed after the flow start are emitted.
        return startPolling(context);
    },

    async tick(context) {

        return pollEntity(context, ENTITY);
    },

    async test(context) {

        // Flow Test Mode: no polling state, emit the most recently created contact.
        const record = await fetchLatestRecord(context, ENTITY);
        if (!record) {
            throw new Error('No contacts found to use as test data.');
        }
        return context.sendJson(record, 'out');
    }
};
