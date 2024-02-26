'use strict';
const { ensureStore, createQueryProcessor } = require('../../common');

async function processNewRows(context, storeId, query, params, lock, idField) {

    const cb = async (row) => {
        const rowId = row[idField];
        await context.store.set(storeId, rowId + '', row);
    };

    const processor = createQueryProcessor(context, storeId, query, params, lock);
    await processor(cb);
}

module.exports = {

    async start(context) {

        const { query, idField, detectOnStop } = context.properties;
        let { storeId } = context.properties;

        const isInitialized = await context.stateGet('initialized');
        const preRegisterWebhook = isInitialized && detectOnStop;

        storeId = await ensureStore(context, storeId, 'NewRow-' + context.componentId);

        // Date.now returns timestamp in ms, but MySQL uses timestamp in seconds
        const now = Math.floor(Date.now() / 1000);
        const timeParam = (await context.stateGet('updatedSince')) || now;

        const params = [timeParam];

        if (preRegisterWebhook) {
            await context.store.registerWebhook(storeId, ['insert']);
        }

        let lock;
        try {
            lock = await context.lock('MySQLNewRow-' + context.componentId, {
                ttl: parseInt(context.config.lockTTL, 10) || 1000 * 60 * 5,
                maxRetryCount: 0
            });

            await processNewRows(context, storeId, query, params, lock, idField);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }

        // Update the updatedSince cache only after the query successfully returned to make this
        // robust against component crashes.
        await context.stateSet('updatedSince', now);

        if (!preRegisterWebhook) {
            await context.store.registerWebhook(storeId, ['insert']);
        }

        await context.stateSet('ignoreNextTick', true);
        await context.stateSet('initialized', true);
    },

    async stop(context) {

        let { storeId, detectOnStop } = context.properties;
        const savedStoredId = await context.stateGet('storeId');
        if (!detectOnStop) {
            await context.stateClear();
        }

        if (!storeId && !detectOnStop) {
            storeId = savedStoredId;
            // No need to unregister our webhook from a store that we just deleted.
            return context.callAppmixer({
                endPoint: '/stores/' + storeId,
                method: 'DELETE'
            });
        }
        return context.store.unregisterWebhook(storeId || savedStoredId);
    },

    async tick(context) {

        if (await context.stateGet('ignoreNextTick')) {
            await context.stateSet('ignoreNextTick', false);
            return;
        }

        let lock;
        try {
            lock = await context.lock('MySQLNewRow-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
        } catch (err) {
            return;
        }

        try {
            const { query, idField } = context.properties;
            let { storeId } = context.properties;
            if (!storeId) {
                storeId = await context.stateGet('storeId');
            }

            // Date.now returns timestamp in ms, but MySQL uses timestamp in seconds
            const now = Math.floor(Date.now() / 1000);
            const lastTime = await context.stateGet('updatedSince');
            const params = [lastTime];

            await processNewRows(context, storeId, query, params, lock, idField);

            // Update last run.
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
