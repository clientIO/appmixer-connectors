'use strict';
const { ensureStore, createQueryProcessor, fetchLatestRow } = require('../../common');

async function processDeletedRowsStart(context, storeId, query, lock, idField) {

    const cb = async (row) => {
        const rowId = row[idField];
        await context.store.set(storeId, rowId + '', row);
    };

    const processor = createQueryProcessor(context, storeId, query, [], lock);
    await processor(cb);
}

async function processDeletedRowsTick(context, storeId, query, lock, idField) {

    const rowIds = [];

    const cb = async (row) => {
        const rowId = row[idField];
        await context.store.set(storeId, rowId + '', row);
        rowIds.push(rowId + '');
    };

    const processor = createQueryProcessor(context, storeId, query, [], lock);
    await processor(cb);

    return rowIds;
}

module.exports = {

    async start(context) {

        const { query, idField } = context.properties;
        let { storeId } = context.properties;

        storeId = await ensureStore(context, storeId, 'DeletedRow-' + context.componentId);

        let lock;
        try {
            lock = await context.lock('MySQLDeletedRow-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });

            await processDeletedRowsStart(context, storeId, query, lock, idField);
            await context.stateSet('ignoreNextTick', true);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async stop(context) {

        let { storeId } = context.properties;
        if (!storeId) {
            storeId = await context.stateGet('storeId');
            return context.callAppmixer({
                endPoint: '/stores/' + storeId,
                method: 'DELETE'
            });
        }
    },

    async tick(context) {

        if (await context.stateGet('ignoreNextTick')) {
            await context.stateSet('ignoreNextTick', false);
            return;
        }

        const { query, idField } = context.properties;

        let { storeId } = context.properties;
        if (!storeId) {
            storeId = await context.stateGet('storeId');
        }

        let lock;
        try {
            lock = await context.lock('MySQLDeletedRow-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });

            // Collect IDs of all the rows in the query result set.
            let rowIds = [];

            rowIds = await processDeletedRowsTick(context, storeId, query, lock, idField);

            // Find items that do not contain the returned row IDs. For higher efficiency, use one query for
            // all the collected IDs instead of querying our data store for each row individually.
            let deletedRows = await context.store.find(storeId, { query: { key: { $nin: rowIds } } });
            //deletedRows = JSON.parse(JSON.stringify(deletedRows));

            for (const deletedRow of deletedRows) {
                await context.sendJson({ row: deletedRow.value }, 'out');
                // Remove from our data store once detected and sent to an output port.
                await context.store.remove(storeId, deletedRow.key + '');
            }
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async test(context) {

        const { query, idField } = context.properties;

        // Read-only: run the same validated SELECT path tick() uses, but collect rows locally
        // instead of writing them to the data store. A genuinely deleted row is not available in
        // Test Mode, so we emit the newest row currently returned by the query in the SAME
        // { row } shape tick() emits on the 'out' port for a detected deletion.
        const row = await fetchLatestRow(context, query, [], idField);
        if (!row) {
            throw new Error('No rows returned by the query to use as test data.');
        }

        return context.sendJson({ row }, 'out');
    }
};
