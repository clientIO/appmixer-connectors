'use strict';
const { ensureStore, createQueryProcessor } = require('../../common');

async function processQueryRows(context, storeId, query, lock, idField) {

    const cb = async (row) => {
        const rowId = row[idField];
        await context.store.set(storeId, rowId + '', row);
    };

    const processor = createQueryProcessor(context, storeId, query, [], lock);
    await processor(cb);
}

module.exports = {

    async start(context) {

        const { idField, query } = context.properties;
        let { storeId } = context.properties;

        storeId = await ensureStore(context, storeId, 'WatchRows-' + context.componentId);

        let lock;
        try {
            lock = await context.lock('MySQLWatchRows-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
            await processQueryRows(context, storeId, query, lock, idField);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }

        await context.store.registerWebhook(storeId, ['insert', 'update']);
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

        return context.store.unregisterWebhook(storeId);
    },

    async tick(context) {

        const { query, idField } = context.properties;

        if (await context.stateGet('ignoreNextTick')) {
            await context.stateSet('ignoreNextTick', false);
            return;
        }

        let { storeId } = context.properties;
        if (!storeId) {
            storeId = await context.stateGet('storeId');
        }

        let lock;
        try {
            lock = await context.lock('MySQLWatchRows-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
            await processQueryRows(context, storeId, query, lock, idField);
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async receive(context) {

        const { referenceFields } = context.properties;

        if (context.messages.webhook.content.data.type === 'update') {

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
                await context.sendJson({ event: 'update', updatedRow: item.value, oldRow: item.oldValue }, 'out');
            }

            return context.response('ok');

        } else if (context.messages.webhook.content.data.type === 'insert') {

            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ event: 'insert', newRow: item.value }, 'out');
            return context.response('ok');
        }
    }
};
