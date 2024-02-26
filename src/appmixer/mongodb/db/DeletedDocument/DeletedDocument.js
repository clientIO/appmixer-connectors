'use strict';
const { getClient, getCollection, getChangeStream, getReplicaSetStatus, ensureStore, setOperationalTimestamp, processDocuments } = require('../../common');
module.exports = {

    async start(context) {

        const client = await getClient(context.auth);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            // await context.log({ isReplicaSet, start: true });
            await context.stateSet('isReplicaSet', isReplicaSet);
            if (isReplicaSet) {
                await setOperationalTimestamp(context);
                return;
            }

            const storeId = await ensureStore(context, 'DeletedDoc-' + context.componentId);
            await processDocuments({ client, context, storeId });
        } finally {
            await client.close();
        }
    },

    async stop(context) {

        const client = await getClient(context.auth);
        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            if (isReplicaSet) return;
            const savedStoredId = await context.stateGet('storeId');
            return context.callAppmixer({
                endPoint: '/stores/' + savedStoredId,
                method: 'DELETE'
            });
        } finally {
            await client.close();
        }
    },

    async tick(context) {

        const client = await getClient(context.auth);
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
            // await context.log({ isReplicaSet });
            if (isReplicaSet) {
                // let resumeToken;
                const collection = getCollection(client, context.auth.database, context.properties.collection);
                const resumeToken = await context.stateGet('resumeToken');
                let startAtOperationTime;
                if (!resumeToken) {
                    startAtOperationTime = await context.stateGet('startAtOperationTime');
                }
                const changeStream = getChangeStream('delete', collection, { resumeToken, startAtOperationTime });

                try {
                    while (await changeStream.hasNext()) {
                        const next = await changeStream.next();
                        const jsonDoc = JSON.parse(JSON.stringify(next.documentKey));
                        await context.sendJson({ document: jsonDoc }, 'out');
                        await context.stateSet('resumeToken', changeStream.resumeToken['_data']);
                    }
                } catch (error) {
                    throw error;
                }
                await new Promise(r => setTimeout(r, context.config.changeStreamsTimeout || 55000));
                changeStream.close();
            } else {
                const storeId = await context.stateGet('storeId');
                const docIds = [];
                await processDocuments({ lock, client, context, storeId, docIds });
                let deletedDocs = await context.store.find(storeId, { query: { key: { $nin: docIds } } });

                for (const doc of deletedDocs) {
                    await context.sendJson({ document: doc.value }, 'out');
                    // Remove from our data store once detected and sent to an output port.
                    await context.store.remove(storeId, doc.key + '');
                }
            }
        } finally {
            await client.close();
            lock && await lock.unlock();
        }
    }
};
