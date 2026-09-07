'use strict';

const { startPolling, pollStageChanges, fetchLatestRecord } = require('../dynamics-commons');

const ENTITY_SET = 'opportunities';
const ID_FIELD = 'opportunityid';
const DEFAULT_STAGE_FIELD = 'salesstage';

module.exports = {

    async start(context) {

        // Baseline the polling window so only records changed after the flow start are emitted.
        return startPolling(context);
    },

    async tick(context) {

        const stageField = context.properties.stageField || DEFAULT_STAGE_FIELD;
        return pollStageChanges(context, { entitySet: ENTITY_SET, idField: ID_FIELD, stageField });
    },

    async test(context) {

        // Flow Test Mode: no polling state, emit the most recently modified opportunity.
        const record = await fetchLatestRecord(context, { entitySet: ENTITY_SET, dateField: 'modifiedon' });
        if (!record) {
            throw new Error('No opportunities found to use as test data.');
        }
        return context.sendJson(record, 'out');
    }
};
