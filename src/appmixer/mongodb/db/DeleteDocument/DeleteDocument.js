'use strict';
const { getClient, getCollection, closeClient, waitForConnectionId } = require('../../common');
const { ObjectId } = require('mongodb');

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
        const { collection: collectionName, id, filter, quantity } = context.messages.in.content;

        const query = id
            ? { _id: ObjectId.isValid(id) ? new ObjectId(id) : (+id || id) }
            : JSON.parse(filter || '{}');

        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const deleteMethod = quantity === 'One' ? 'deleteOne' : 'deleteMany';
            const { deletedCount } = await collection[deleteMethod](query);

            await context.sendJson({ deletedCount }, 'out');
        } catch (error) {
            throw error;
        }
    }
};
