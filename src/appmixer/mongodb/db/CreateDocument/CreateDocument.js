'use strict';
const { getClient, getCollection } = require('../../common');

module.exports = {

    async receive(context) {

        const { collection: collectionName, document } = context.messages.in.content;
        const client = await getClient(context.auth);
        const data = JSON.parse(document);
        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const record = await collection.insertOne(data);
            await context.sendJson({ document: { id: record.insertedId, ...data } }, 'out');
        } finally {
            await client.close();
        }
    }
};
