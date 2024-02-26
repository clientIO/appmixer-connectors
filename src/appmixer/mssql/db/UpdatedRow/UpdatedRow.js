'use strict';
const { ensureStore, createQueryProcessor } = require('../../common');

async function processUpdatedRows(context, storeId, query, params, lock, idField) {

    const cb = async (row) => {
        const rowId = row[idField];
        await context.store.set(storeId, rowId + '', row);
    };

    const processor = createQueryProcessor(context, storeId, query, params, lock);
    await processor(cb);
}

module.exports = {

    async start(context) {

        const { idField, recordOldValues, detectOnStop, query } = context.properties;
        let { storeId } = context.properties;

        const isInitialized = await context.stateGet('initialized');
        const preRegisterWebhook = isInitialized && detectOnStop;

        const webhookEvents = recordOldValues ? ['update'] : ['insert', 'update'];

        storeId = await ensureStore(context, storeId, 'UpdatedRow-' + context.componentId);

        // Date.now returns timestamp in ms, but mssql uses timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        const timeParam = (await context.stateGet('updatedSince')) || now;

        // In case the query contains the special "?" character, we replace it with 0 in the initial run.
        // This special character is supposed to be used mainly in connection with "updated_at" type of fields.
        // For example: `select * from mssql_test where updated_at > ?`. The logic behind the special placeholder
        // is that in the initial run, we set it to 0, meaning ALL rows are queries. Next scheduled runs
        // only select rows updated since the last run.
        const params = [recordOldValues ? 0 : timeParam];

        if (preRegisterWebhook) {
            await context.store.registerWebhook(storeId, webhookEvents);
        }

        let lock;
        try {
            lock = await context.lock('mssqlUpdatedRow-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
            await processUpdatedRows(context, storeId, query, params, lock, idField);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }

        // Update the updatedSince cache only after the query successfully returned to make this
        // robust against component crashes.
        await context.stateSet('updatedSince', now);

        if (!preRegisterWebhook) {
            await context.store.registerWebhook(storeId, webhookEvents);
        }
        await context.stateSet('ignoreNextTick', true);
        await context.stateSet('initialized', true);
    },

    async stop(context) {

        let { storeId, detectOnStop } = context.properties;
        const savedStoreId = await context.stateGet('storeId');
        if (!detectOnStop) {
            await context.stateClear();
        }
        if (!storeId && !detectOnStop) {
            storeId = savedStoreId;
            // No need to unregister our webhook from a store that we just deleted.
            return context.callAppmixer({
                endPoint: '/stores/' + storeId,
                method: 'DELETE'
            });
        }

        return context.store.unregisterWebhook(storeId || savedStoreId);
    },

    async tick(context) {

        if (await context.stateGet('ignoreNextTick')) {
            await context.stateSet('ignoreNextTick', false);
            return;
        }

        const { query, idField } = context.properties;

        let lock;
        try {
            lock = await context.lock('mssqlUpdatedRow-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
        } catch (err) {
            return;
        }

        let { storeId } = context.properties;
        if (!storeId) {
            storeId = await context.stateGet('storeId');
        }

        // Date.now returns timestamp in ms, but mssql uses timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        const params = [await context.stateGet('updatedSince')];

        await processUpdatedRows(context, storeId, query, params, lock, idField);

        // Update the updatedSince cache only after the query successfully returned to make this
        // robust against component crashes.
        await context.stateSet('updatedSince', now);
    },

    async receive(context) {

        const { recordOldValues, referenceFields } = context.properties;

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
            // Moreover, if the user provided referenceFields, we only check for differences in these.
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
