'use strict';

const { startPolling, resolveGenericEntity, pollEntity, fetchLatestRecord } = require('../dynamics-commons');

const DATE_FIELD = 'modifiedon';

module.exports = {

    async start(context) {

        // Baseline the polling window so only records changed after the flow start are emitted.
        return startPolling(context);
    },

    async tick(context) {

        return pollEntity(context, await resolveGenericEntity(context, DATE_FIELD));
    },

    async test(context) {

        // Flow Test Mode: no polling state, emit the most recently modified record of the selected entity.
        const entity = await resolveGenericEntity(context, DATE_FIELD);
        const record = await fetchLatestRecord(context, entity);
        if (!record) {
            throw new Error(`No ${entity.logicalName} records found to use as test data.`);
        }
        return context.sendJson(record, 'out');
    }
};
