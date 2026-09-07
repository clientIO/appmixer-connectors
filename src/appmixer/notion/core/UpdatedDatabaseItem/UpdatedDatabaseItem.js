'use strict';
const lib = require('../../lib');

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;

        let since = context.state.since || new Date().toISOString();
        let updatedItems = [];

        const results = await lib.queryDatabaseItems(context, databaseId, {
            timestamp: 'last_edited_time',
            direction: 'descending'
        });

        results.forEach(item => {
            const itemLastEditedTime = item.last_edited_time;

            if (itemLastEditedTime > since) {
                updatedItems.push(item);
            }
        });

        if (updatedItems.length > 0) {
            await Promise.all(updatedItems.map(updatedItem => context.sendJson(updatedItem, 'out')));
        }

        const latestUpdateTime = updatedItems.length > 0 ? updatedItems[0].last_edited_time : since;
        await context.saveState({ since: latestUpdateTime });
    },

    async test(context) {
        const databaseId = context.properties.databaseId;

        // Fetch newest-first WITHOUT the `since` baseline (which defaults to "now" and
        // suppresses tick()'s first run), emit the single most-recently-edited item in
        // the exact shape tick() emits.
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
