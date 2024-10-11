'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');
const { StreamProcessor } = require('../common');
const moduleCommons = require('../common');

async function processUpdateRowStream(rowsStream, context, storeId, idField, lock) {

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

async function startRoutine(context) {

    const { query, idField, detectOnStop, recordOldValues, projectId } = context.properties;
    const storeId = await moduleCommons.ensureStore(context, 'UpdatedRow');

    const isInitialized = await context.stateGet('initialized');
    const preRegisterWebhook = isInitialized && detectOnStop;

    const webhookEvents = recordOldValues ? ['update'] : ['insert', 'update'];

    // Date.now returns timestamp in ms, but MySQL uses timestamp in seconds
    const now = Date.now();
    const timeParam = (await context.stateGet('updatedSince')) || now;

    const client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    const params = [recordOldValues ? 0 : timeParam];

    if (preRegisterWebhook) {
        await context.store.registerWebhook(storeId, webhookEvents);
    }

    let lock;
    try {
        lock = await context.lock('BigQueryUpdatedRow-' + context.componentId, {
            ttl: parseInt(context.config.lockTTL, 10) || 1000 * 60 * 5,
            maxRetryCount: 0
        });
        await context.log({ step: 'Querying data.', query });
        const rowsStream = await runQuery(client, query, params);
        await processUpdateRowStream(rowsStream, context, storeId, idField);

        // Update the updatedSince cache only after the query successfully returned to make this
        // robust against component crashes.
        await context.stateSet('updatedSince', now);

        if (!preRegisterWebhook) {
            await context.store.registerWebhook(storeId, webhookEvents);
        }

        await context.stateSet('initialized', true);
        await context.stateSet('started', true);
    } finally {
        if (lock) {
            lock.unlock();
        }
    }
}

async function runQuery(client, query, params = {}) {

    const [job] = await client.createQueryJob({ query, params });
    return job.getQueryResultsStream({
        wrapIntegers: {
            integerTypeCastFunction: value => {
                return parseInt(value) > Number.MAX_SAFE_INTEGER ? value : parseInt(value);
            }
        }
    });
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
        const params = [await context.stateGet('updatedSince')];

        let lock;
        try {
            lock = await context.lock('BigQueryUpdatedRow-' + context.componentId, {
                ttl: parseInt(context.config.lockTTL, 10) || 1000 * 60 * 5,
                maxRetryCount: 0
            });
            await context.log({ step: 'Querying data.', query });
            const rowsStream = await runQuery(client, query, params);
            await processUpdateRowStream(rowsStream, context, storeId, idField);

            // Update the updatedSince cache only after the query successfully returned to make this
            // robust against component crashes.
            await context.stateSet('updatedSince', now);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async receive(context) {

        const { referenceFields, recordOldValues } = context.properties;

        if (!recordOldValues && context.messages.webhook.content.data.type === 'insert') {

            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ updatedRow: item.value }, 'out');
            return context.response('ok');
        } else if (context.messages.webhook.content.data.type === 'update') {

            if (!recordOldValues) {
                const item = context.messages.webhook.content.data.currentValue;
                await context.sendJson({ updatedRow: item.value }, 'out');
                return context.response('ok');
            }

            // Since the "update" data store event fires for any update under the key,
            // we need to check whether the values actually changed before firing the output port.
            // Moreoever, if the user provided referenceFields, we only check for differences in these.
            let fire = false;

            const item = context.messages.webhook.content.data.currentValue;
            if (JSON.stringify(item.value) !== JSON.stringify(item.oldValue)) {
                if (referenceFields && referenceFields.trim()) {
                    const referenceFieldsArray = (referenceFields || '').split(',').map(field => field.trim());
                    referenceFieldsArray.forEach(field => {
                        if (item.value[field] !== item.oldValue[field]) {
                            fire = true;
                        }
                    });
                } else {
                    fire = true;
                }
            }
            if (fire) {
                await context.sendJson({ updatedRow: item.value, oldRow: item.oldValue }, 'out');
            }

            return context.response('ok');
        }
    }
};
