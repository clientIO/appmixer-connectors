'use strict';
const { getClient, getCollection, getChangeStream, getReplicaSetStatus, ensureStore, setOperationalTimestamp, processDocuments, closeClient } = require('../../common');
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
        const connectionId = await context.stateGet('connectionId');

        if (!connectionId) {

            await context.log({ step: 'connecting', message: 'Connection to mongo not yet established. Waiting for connectionId.' });
            // It might have happened that the connectionId was not yet stored to the state in the start() method.
            // This can occur if another component sent a message to our SendMessage before our start() method finished.
            // See e.g. the implementation of OnStart (https://github.com/clientIO/appmixer-connectors/blob/dev/src/appmixer/utils/controls/OnStart/OnStart.js).
            const checkStartTime = new Date;
            const maxWaitTime = 10000;  // 10 seconds
            await new Promise((resolve, reject) => {
                const intervalId = setInterval(async () => {
                    connectionId = await context.stateGet('connectionId');
                    if (connectionId) {
                        clearInterval(intervalId);
                        await context.log({ step: 'connected', message: 'Connection to mongo established.' });
                        resolve();
                    } else if (new Date - checkStartTime > maxWaitTime) {
                        clearInterval(intervalId);
                        reject(new Error('Connection not established.'));
                    }
                }, 500);
            });
        }

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
