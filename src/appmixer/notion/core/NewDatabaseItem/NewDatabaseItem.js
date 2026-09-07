'use strict';
const lib = require('../../lib');

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;
        let newState = {};
        let knownItems = new Set(context.state.known || []);

        const results = await lib.queryDatabaseItems(context, databaseId, {
            timestamp: 'created_time',
            direction: 'descending'
        });

        const currentItems = [];
        const newItems = [];

        results.forEach(item => {
            currentItems.push(item.id);
            if (!knownItems.has(item.id)) {
                if (context.state.known) { // Only consider it new if state.known is already set
                    newItems.push(item);
                }
            }
        });

        newState.known = currentItems;

        await context.saveState(newState);

        if (context.state.known) { // Only send new items if state.known is already set
            await Promise.all(newItems.map(newItem => context.sendJson(newItem, 'out')));
        }
    },

    async test(context) {
        const databaseId = context.properties.databaseId;

        // Fetch newest-first WITHOUT the baseline that suppresses tick()'s first run,
        // emit the single most recent item in the exact shape tick() emits.
        const results = await lib.queryDatabaseItems(context, databaseId, {
            timestamp: 'created_time',
            direction: 'descending',
            pageSize: 1
        });

        if (!results.length) {
            throw new Error('No items in the database to use as test data.');
        }

        return context.sendJson(results[0], 'out');
    }
};
