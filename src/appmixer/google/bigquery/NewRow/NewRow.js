'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');
const { StreamProcessor } = require('../common');
const moduleCommons = require('../common');

async function processNewRowStream(rowsStream, context, storeId, idField, lock) {

    let nRows = 0;
    const streamProcessor = new StreamProcessor();
    streamProcessor.onBatchProcessed(() => {
        lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 2);
    });
    await streamProcessor.processStream(rowsStream, context, storeId, idField, (storeId, rowId, row) => {
        nRows++;
        return context.store.set(storeId, rowId, row);
    });
    await context.log({ step: 'Data received.', nRows });
}

async function runQuery(client, query, params) {

    const [job] = await client.createQueryJob({ query, params });
    return job.getQueryResultsStream({
        wrapIntegers: {
            integerTypeCastFunction: value => {
                return parseInt(value) > Number.MAX_SAFE_INTEGER ? value : parseInt(value);
            }
        }
    });
}

async function startRoutine(context) {

    const { query, idField, detectOnStop, projectId } = context.properties;

    const storeId = await moduleCommons.ensureStore(context, 'NewRow');

    const client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    const isInitialized = await context.stateGet('initialized');

    const preRegisterWebhook = isInitialized && detectOnStop;

    if (preRegisterWebhook) {
        await context.store.registerWebhook(storeId, ['insert']);
    }

    // Date.now returns timestamp in ms, but MySQL uses timestamp in seconds
    const now = Date.now();
    const timeParam = Math.floor((await context.stateGet('updatedSince')) || now);

    const params = [timeParam];

    await context.log({ step: 'Querying data.', query });

    let lock;
    try {
        lock = await context.lock('BigQueryNewRow-' + context.componentId, {
            ttl: parseInt(context.config.lockTTL, 10) || 1000 * 60 * 5,
            maxRetryCount: 0
        });
        const rowsStream = await runQuery(client, query, params);
        await processNewRowStream(rowsStream, context, storeId, idField, lock);

        // Update the updatedSince cache only after the query successfully returned to make this
        // robust against component crashes.
        await context.stateSet('updatedSince', now);

        if (!preRegisterWebhook) {
            await context.store.registerWebhook(storeId, ['insert']);
        }
        await context.stateSet('initialized', true);
        await context.stateSet('started', true);

    } finally {
        if (lock) {
            lock.unlock();
        }
    }
}

module.exports = {

    async stop(context) {

        await moduleCommons.cleanupStorage(context);
        await context.stateSet('started', false);
    },

    async tick(context) {

        const started = await context.stateGet('started');

        if (!started) {
            return startRoutine(context);
        }

        const { query, idField, projectId } = context.properties;

        const storeId = await moduleCommons.getStoreId(context);

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const now = Date.now();
        const lastTime = Math.floor(await context.stateGet('updatedSince'));
        const params = [lastTime];

        let lock;
        try {
            lock = await context.lock('BigQueryNewRow-' + context.componentId, {
                ttl: parseInt(context.config.lockTTL, 10) || 1000 * 60 * 5,
                maxRetryCount: 0
            });

            await context.log({ step: 'Querying data.', query });
            const rowsStream = await runQuery(client, query, params);

            await processNewRowStream(rowsStream, context, storeId, idField, lock);

            // Schedule next run.
            await context.stateSet('updatedSince', now);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async receive(context) {

        if (context.messages.webhook.content.data.type === 'insert') {
            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ row: item.value }, 'out');
            return context.response('ok');
        }
    }
};
