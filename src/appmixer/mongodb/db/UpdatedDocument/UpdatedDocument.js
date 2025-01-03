'use strict';

const { getClient, getCollection, getChangeStream, getReplicaSetStatus, ensureStore, setOperationalTimestamp, processDocuments, closeClient } = require('../../common');

module.exports = {
    async start(context) {
        const client = await getClient(context);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            await context.stateSet('isReplicaSet', isReplicaSet);

            if (isReplicaSet) {
                await setOperationalTimestamp(context);
                return;
            }

            const storeId = await ensureStore(context, 'UpdatedDoc-' + context.componentId);
            await processDocuments({ client, context, storeId });
            await context.store.registerWebhook(storeId, ['insert', 'update']);
        } catch (error) {
            throw error;
        }
    },

    async receive(context) {
        if (context.messages.webhook?.content.data.type === 'update') {
            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ document: item.value, oldDocument: item.oldValue }, 'out');
            return context.response('ok');
        }
    },

    async stop(context) {
        const client = await getClient(context.auth);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            if (isReplicaSet) return;

            const savedStoredId = await context.stateGet('storeId');
            await context.store.unregisterWebhook(savedStoredId);
        } finally {
            await closeClient(context.auth.connectionUri);
        }
    },

    async tick(context) {
        let client = await getClient(context.auth);
        let lock;
        try {
            lock = await context.lock('MongoDbNewDoc-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
        } catch (err) {
            return;  // Exit if lock cannot be acquired
        }

        try {
            const isReplicaSet = await context.stateGet('isReplicaSet');
            const collection = getCollection(client, context.auth.database, context.properties.collection);

            if (isReplicaSet) {
                const resumeToken = await context.stateGet('resumeToken');
                const changeStream = getChangeStream('update', collection, { resumeAfter: resumeToken });

                while (await changeStream.hasNext()) {
                    const next = await changeStream.next();
                    const jsonDoc = JSON.parse(JSON.stringify(next.documentKey));

                    // Send updated document
                    await context.sendJson({ document: jsonDoc }, 'out');

                    // Save resume token and operational timestamp
                    await context.stateSet('resumeToken', changeStream.resumeToken);
                    await setOperationalTimestamp(context, next.clusterTime);
                }
            } else {
                const storeId = await context.stateGet('storeId');
                await processDocuments({ lock, client, context, storeId });
            }
        } catch (error) {
            console.error('Tick error:', error);
        } finally {
            lock && await lock.unlock();
        }
    }
};
