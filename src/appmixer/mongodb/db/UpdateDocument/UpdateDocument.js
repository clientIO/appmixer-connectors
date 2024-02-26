'use strict';
const { getClient, getCollection } = require('../../common');
const { ObjectId } = require('mongodb');

module.exports = {

    async receive(context) {

        const { collection: collectionName, id, filter, document, upsert, quantity } = context.messages.in.content;
        const client = await getClient(context.auth);
        const data = JSON.parse(document);
        const query = id ? { _id: ObjectId.isValid(id) ? new ObjectId(id) : (+id || id) } : JSON.parse(filter || '{}');

        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const updateMethod = quantity === 'One' ? 'updateOne' : 'updateMany';
            const options = { upsert };
            const {
                matchedCount,
                modifiedCount,
                upsertedCount,
                upsertedId,
                acknowledged
            } = await collection[updateMethod](query, { $set: data }, options);
            await context.sendJson({
                document: { id, ...data },
                acknowledged,
                matchedCount,
                modifiedCount,
                upsertedCount,
                upsertedId
            }, 'out');
        } finally {
            await client.close();
        }
    }
};
