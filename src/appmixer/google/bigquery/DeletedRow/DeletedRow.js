'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');
const { processStream } = require('../common');
const moduleCommons = require('../common');

async function processDeletedRowStream(rowsStream, context, storeId, idField) {

    const rowIds = [];
    await processStream(rowsStream, context, storeId, idField, async (storeId, rowId, row) => {
        rowIds.push(rowId);
        return context.store.set(storeId, rowId, row);
    });
    return rowIds;
}

function processStartRowStream(rowsStream, context, storeId, idField) {
    return processStream(rowsStream, context, storeId, idField, (storeId, rowId, row) => {
        return context.store.set(storeId, rowId, row);
    });
}

module.exports = {

    async start(context) {

        const { query, idField } = context.properties;

        const storeId = await moduleCommons.ensureStore(context, 'DeletedRow');

        const projectId = await moduleCommons.getProjectId(context);

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const rowsStream = await this.runQuery(client, query);
        await processStartRowStream(rowsStream, context, storeId, idField);

        await context.stateSet('ignoreNextTick', true);
    },

    async stop(context) {

        let { storeId } = context.properties;
        if (!storeId) {
            storeId = await context.stateGet('storeId');
            // No need to unregister our webhook from a store that we just deleted.
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

        const storeId = await moduleCommons.getStoreId(context);

        const projectId = await moduleCommons.getProjectId(context);

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const rowsStream = await this.runQuery(client, query);
        const rowIds = await processDeletedRowStream(rowsStream, context, storeId, idField);


        // Find items that do not contain the returned row IDs.
        let deletedItems = await context.store.find(storeId, { query: { key: { $nin: rowIds } } });
        deletedItems = JSON.parse(JSON.stringify(deletedItems));

        for (let i = 0; i < deletedItems.length; i++) {
            await context.store.remove(storeId, deletedItems[i].key + '');
            await context.sendJson({ row: deletedItems[i].value }, 'out');
        }
    },

    async runQuery(client, query) {

        const [job] = await client.createQueryJob({ query });
        return job.getQueryResultsStream();
    }
};
