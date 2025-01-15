'use strict';
const { getClient, getCollection, waitForConnectionId } = require('../../common');

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

        const { collection: collectionName, operation, query } = context.messages.in.content;

        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const result = await collection[operation](JSON.parse(query));
            let documents = result;
            if (operation != 'findOne') {
                documents = await result.limit(1000).toArray();
            }
            await context.sendJson({ documents }, 'out');
        } catch (error) {
            throw error;
        }
    }
};

