'use strict';
const { getClient, getCollection, getChangeStream, getReplicaSetStatus, ensureStore, setOperationalTimestamp, processDocuments, closeClient } = require('../../common');
module.exports = {

    async start(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const { client, connectionId } = await getClient(context, flowId, componentId, connectionUri, context.auth);

        context.stateSet('connectionId', connectionId);
        const isReplicaSet = await getReplicaSetStatus(client);
        // await context.log({ isReplicaSet, start: true });
        await context.stateSet('isReplicaSet', isReplicaSet);
        if (isReplicaSet) {
            await setOperationalTimestamp(context);
            return;
        }

        const storeId = await ensureStore(context, 'UpdatedDoc-' + context.componentId);
        await processDocuments({ client, context, storeId });
        await context.store.registerWebhook(storeId, ['insert', 'update']);

    },

    async receive(context) {

        if (context.messages.webhook.content.data.type === 'update') {
            const item = context.messages.webhook.content.data.currentValue;
            await context.sendJson({ document: item.value, oldDocument: item.oldValue }, 'out');
            return context.response('ok');
        }
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
            await context.store.unregisterWebhook(savedStoredId);
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
            if (isReplicaSet) {
                // let resumeToken;
                const collection = getCollection(client, context.auth.database, context.properties.collection);
                const resumeToken = await context.stateGet('resumeToken');
                let startAtOperationTime;
                if (!resumeToken) {
                    startAtOperationTime = await context.stateGet('startAtOperationTime');
                }
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
                }
                // await new Promise(r => setTimeout(r, context.config.changeStreamsTimeout || 55000));
                // changeStream.close();
            } else {
                const storeId = await context.stateGet('storeId');

                await processDocuments({ lock, client, context, storeId });
            }
        } finally {
            lock && await lock.unlock();
        }
    }
};
