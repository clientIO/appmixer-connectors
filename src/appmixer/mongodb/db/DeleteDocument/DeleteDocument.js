'use strict';
const { getClient, getCollection } = require('../../common');
const { ObjectId } = require('mongodb');

module.exports = {

    async receive(context) {

        const { collection: collectionName, id, filter, quantity } = context.messages.in.content;
        const client = await getClient(context.auth);
        const query = id ? { _id: ObjectId.isValid(id) ? new ObjectId(id) : (+id || id) } : JSON.parse(filter || '{}');

        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const deleteMethod = quantity === 'One' ? 'deleteOne' : 'deleteMany';
            const { deletedCount } = await collection[deleteMethod](query);
            await context.sendJson({ deletedCount }, 'out');
        } finally {
            await client.close();
        }
    }
};
