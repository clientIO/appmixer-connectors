'use strict';
const {
    getClient,
    getCollection,
    getChangeStream,
    getReplicaSetStatus,
    ensureStore,
    setOperationalTimestamp,
    processDocuments,
    closeClient
} = require('../../common');

module.exports = {

    async start(context) {
        const { componentId, flowId } = context;
        const client = await getClient(context, flowId, componentId, context.auth);

        const isReplicaSet = await getReplicaSetStatus(client);
        await context.stateSet('isReplicaSet', isReplicaSet);
        if (isReplicaSet) {
            await setOperationalTimestamp(context);
            return;
        }
        let { storeId } = context.properties;

        storeId = await ensureStore(context, 'NewDoc-' + context.componentId, storeId);
        await processDocuments({ client, context, storeId });
        await context.store.registerWebhook(storeId, ['insert']);

    },

    async receive(context) {

        if (context.messages.webhook.content.data.type === 'insert') {
            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ document: item.value }, 'out');
            return context.response('ok');
        }
    },

    async stop(context) {
        const connectionId = await context.stateGet('connectionId');
        const client = await getClient(context);

        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            if (isReplicaSet) return;

            const savedStoredId = await context.stateGet('storeId');
            if (savedStoredId) {
                await context.store.unregisterWebhook(savedStoredId);
            }
        } finally {
            if (connectionId) {
                await closeClient(context, connectionId);
            }
        }
    },

    async tick(context) {

        const client = await getClient(context);
        let lock;
        try {
            lock = await context.lock('MongoDbNewDoc-' + context.componentId, {
                ttl: 1000 * 60 * 5,
                maxRetryCount: 0
            });
        } catch (err) {
            return;
        }
        try {
            const isReplicaSet = await context.stateGet('isReplicaSet');
            if (isReplicaSet) {
                // let resumeToken;
                const collection = getCollection(client, context.auth.database, context.properties.collection);
                const resumeToken = await context.stateGet('resumeToken');
                let startAtOperationTime;
                if (!resumeToken) {
                    startAtOperationTime = await context.stateGet('startAtOperationTime');
                }
                const changeStream = getChangeStream('insert', collection, { resumeToken, startAtOperationTime });

                try {
                    while (await changeStream.hasNext()) {
                        const next = await changeStream.next();
                        const jsonDoc = JSON.parse(JSON.stringify(next.fullDocument));
                        await context.sendJson({ document: jsonDoc }, 'out');
                        await context.stateSet('resumeToken', changeStream.resumeToken['_data']);

                    }
                } catch (error) {
                    throw error;
                }
            } else {
                const storeId = await context.stateGet('storeId');

                await processDocuments({ lock, client, context, storeId });
            }
        } finally {
            lock && await lock.unlock();
        }
    }
};
