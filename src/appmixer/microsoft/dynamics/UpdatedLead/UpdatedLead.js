'use strict';

const { startPolling, pollEntity, fetchLatestRecord } = require('../dynamics-commons');

const ENTITY = { logicalName: 'lead', entitySet: 'leads', dateField: 'modifiedon' };

module.exports = {

    async start(context) {

        // Baseline the polling window so only records changed after the flow start are emitted.
        return startPolling(context);
    },

    async tick(context) {

        return pollEntity(context, ENTITY);
    },

    async test(context) {

        // Flow Test Mode: no polling state, emit the most recently modified lead.
        const record = await fetchLatestRecord(context, ENTITY);
        if (!record) {
            throw new Error('No leads found to use as test data.');
        }
        return context.sendJson(record, 'out');
    }
};
