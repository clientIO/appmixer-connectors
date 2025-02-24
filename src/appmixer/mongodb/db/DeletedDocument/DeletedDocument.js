'use strict';
const {
    getClient,
    getCollection,
    getChangeStream,
    getReplicaSetStatus,
    ensureStore,
    setOperationalTimestamp,
    processDocuments,
    closeClient,
    waitForConnectionId
} = require('../../common');

module.exports = {
    async start(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const { client, connectionId } = await getClient(context, flowId, componentId, connectionUri, context.auth);

        context.stateSet('connectionId', connectionId);

        const isReplicaSet = await getReplicaSetStatus(client);
        await context.stateSet('isReplicaSet', isReplicaSet);

        if (isReplicaSet) {
            await setOperationalTimestamp(context);
            return;
        }

        const storeId = await ensureStore(context, 'DeletedDoc-' + context.componentId);
        await processDocuments({ client, context, storeId });

        await client.close();
    },

    async stop(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const connectionId = await context.stateGet('connectionId');
        const { client } = await getClient(context, flowId, componentId, connectionUri, context.auth, connectionId);

        try {
            const isReplicaSet = await getReplicaSetStatus(client);
            if (isReplicaSet) return;

            const savedStoredId = await context.stateGet('storeId');
            return context.callAppmixer({
                endPoint: '/stores/' + savedStoredId,
                method: 'DELETE'
            });
        } finally {
            await closeClient(context, connectionId);
            await context.stateUnset('connectionId');
        }
    },

    async tick(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const connectionId = await waitForConnectionId(context);
        const { client } = await getClient(context, flowId, componentId, connectionUri, context.auth, connectionId);

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

                const deletedDocs = await context.store.find(storeId, { query: { key: { $nin: docIds } } });

                for (const doc of deletedDocs) {
                    await context.sendJson({ document: doc.value }, 'out');
                    await context.store.remove(storeId, doc.key + '');
                }
            }
        } finally {
            await client.close();
            lock && await lock.unlock();
        }
    }
};
