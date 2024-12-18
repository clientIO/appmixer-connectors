'use strict';
const { 
    getClient, 
    getCollection, 
    getChangeStream, 
    getReplicaSetStatus, 
    ensureStore, 
    setOperationalTimestamp, 
    processDocuments 
} = require('../../common');

module.exports = {
    async start(context) {
        const client = await getClient(context);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            await context.stateSet('isReplicaSet', isReplicaSet);
    
            if (isReplicaSet) {
                await setOperationalTimestamp(context);
                return; // Exit early for replica sets
            }
    
            const storeId = await ensureStore(context, 'UpdatedDoc-' + context.componentId);
            await processDocuments({ client, context, storeId });
            await context.store.registerWebhook(storeId, ['insert', 'update']);
        } catch (error) {
            await context.log('error', `Error in start: ${error.message}`);
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
        const client = await getClient(context);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);

            if (!isReplicaSet) {
                const savedStoreId = await context.stateGet('storeId');
                await context.store.unregisterWebhook(savedStoreId);
            }
        } catch (error) {
            await context.log('error', `Error in stop: ${error.message}`);
        }
    },

    async tick(context) {
        const client = await getClient(context);
        let lock;

        try {
            lock = await context.lock('MongoDbUpdatedDoc-' + context.componentId, {
                ttl: 1000 * 60 * 5, // 5 minutes
                maxRetryCount: 0
            });

            const isReplicaSet = await context.stateGet('isReplicaSet');
            const collection = getCollection(client, context.auth.database, context.properties.collection);

            if (isReplicaSet) {
                // Change Stream logic for replica sets
                const resumeToken = await context.stateGet('resumeToken');
                let startAtOperationTime = await context.stateGet('startAtOperationTime');
                const changeStream = getChangeStream('update', collection, { resumeToken, startAtOperationTime });

                try {
                    while (await changeStream.hasNext()) {
                        const next = await changeStream.next();
                        const jsonDoc = JSON.parse(JSON.stringify(next.documentKey));
                        await context.sendJson({ document: { ...jsonDoc, ...next.updateDescription } }, 'out');
                        await context.stateSet('resumeToken', changeStream.resumeToken['_data']);
                    }
                } catch (error) {
                    await context.log('error', `Error in change stream: ${error.message}`);
                }
            } else {
                // Non-replica set logic
                const storeId = await context.stateGet('storeId');
                await processDocuments({ lock, client, context, storeId });
            }
        } catch (error) {
            await context.log('error', `Error in tick: ${error.message}`);
        } finally {
            lock && await lock.unlock();
        }
    }
};
