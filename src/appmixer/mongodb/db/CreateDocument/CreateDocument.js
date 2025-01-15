'use strict';
const { getClient, getCollection, closeClient, waitForConnectionId } = require('../../common');

module.exports = {
    async start(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const { connectionId } = await getClient(context, flowId, componentId, connectionUri, context.auth);

        context.stateSet('connectionId', connectionId);


    },

    async stop(context) {

        const connectionId = await context.stateGet('connectionId');
        await closeClient(context, connectionId);
        await context.stateUnset('connectionId');
    },

    async receive(context) {
        const { componentId, flowId } = context;
        const connectionUri = context.auth.connectionUri;

        const connectionId = await waitForConnectionId(context);

        const { client } = await getClient(context, flowId, componentId, connectionUri, context.auth, connectionId);

        const { collection: collectionName, document } = context.messages.in.content;
        const data = JSON.parse(document);
        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const record = await collection.insertOne(data);
            await context.sendJson({ document: { id: record.insertedId, ...data } }, 'out');
        } catch (error) {
            throw error;
        }
    }
};
