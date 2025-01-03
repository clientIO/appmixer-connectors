'use strict';
<<<<<<< Updated upstream
const {
    getClient,
    getCollection,
    getChangeStream,
    getReplicaSetStatus,
    ensureStore,
    setOperationalTimestamp,
    processDocuments
} = require('../../common');

=======
const { getClient, getCollection, getChangeStream, getReplicaSetStatus, ensureStore, setOperationalTimestamp, processDocuments, closeClient } = require('../../common');
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        const client = await getClient(context);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);

            if (!isReplicaSet) {
                const savedStoreId = await context.stateGet('storeId');
                await context.store.unregisterWebhook(savedStoreId);
            }
        } catch (error) {
            await context.log('error', `Error in stop: ${error.message}`);
=======
        const client = await getClient(context.auth);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            if (isReplicaSet) return;

            const savedStoredId = await context.stateGet('storeId');
            await context.store.unregisterWebhook(savedStoredId);
        } finally {
            await closeClient(context.auth.connectionUri);
>>>>>>> Stashed changes
        }
    },

    async tick(context) {
<<<<<<< Updated upstream
        const client = await getClient(context);
=======
        let client = await getClient(context.auth);
>>>>>>> Stashed changes
        let lock;

        try {
            lock = await context.lock('MongoDbUpdatedDoc-' + context.componentId, {
                ttl: 1000 * 60 * 5, // 5 minutes
                maxRetryCount: 5,
                retryDelay: 3000
            });
<<<<<<< Updated upstream

=======
        } catch (err) {
            return;  // Exit if lock cannot be acquired
        }

        try {
>>>>>>> Stashed changes
            const isReplicaSet = await context.stateGet('isReplicaSet');
            const collection = getCollection(client, context.auth.database, context.properties.collection);

            if (isReplicaSet) {
<<<<<<< Updated upstream
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
                    throw error;
=======
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
>>>>>>> Stashed changes
                }
            } else {
                // Non-replica set logic
                const storeId = await context.stateGet('storeId');
                await processDocuments({ lock, client, context, storeId });
            }
        } catch (error) {
<<<<<<< Updated upstream
            throw error;
=======
            console.error('Tick error:', error);
>>>>>>> Stashed changes
        } finally {
            lock && await lock.unlock();
        }
    }
};
