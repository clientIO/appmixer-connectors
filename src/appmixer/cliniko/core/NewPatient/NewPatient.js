'use strict';

const lib = require('../../lib');

const POLL = {
    path: '/patients',
    collection: 'patients',
    timestampField: 'created_at',
    relations: []
};

/**
 * This trigger has no configurable filters.
 * @returns {Array<string>}
 */
function buildFilters() {

    return [];
}

module.exports = {

    async tick(context) {

        const { emit, state } = await lib.pollByTimestamp(context, {
            ...POLL,
            filters: buildFilters(context.properties || {})
        });

        for (const record of emit) {
            await context.sendJson(record, 'out');
        }

        await context.saveState(state);
    },

    // Flow Test Mode: emit the most recent matching record. Read-only, no state writes.
    async test(context) {

        const record = await lib.fetchLatest(context, {
            ...POLL,
            filters: buildFilters(context.properties || {})
        });

        if (!record) {
            throw new Error('No patients found to use as test data.');
        }

        return context.sendJson(record, 'out');
    }
};
