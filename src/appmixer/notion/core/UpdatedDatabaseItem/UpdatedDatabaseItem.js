'use strict';
const lib = require('../../lib');

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;

        const { emit, state } = await lib.pollDatabaseItems(context, databaseId, 'last_edited_time');

        for (const item of emit) {
            await context.sendJson(item, 'out');
        }

        await context.saveState(state);
    },

    async test(context) {
        const databaseId = context.properties.databaseId;

        // Fetch newest-first WITHOUT the baseline that suppresses tick()'s first run,
        // emit the single most-recently-edited item in the exact shape tick() emits.
        const results = await lib.queryDatabaseItems(context, databaseId, {
            timestamp: 'last_edited_time',
            direction: 'descending',
            pageSize: 1
        });

        if (!results.length) {
            throw new Error('No items in the database to use as test data.');
        }

        return context.sendJson(results[0], 'out');
    }
};
