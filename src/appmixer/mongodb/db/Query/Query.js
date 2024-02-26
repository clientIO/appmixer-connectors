'use strict';
const { getClient, getCollection } = require('../../common');

module.exports = {

    async receive(context) {

        const { collection: collectionName, operation, query } = context.messages.in.content;
        const client = await getClient(context.auth);
        try {
            const collection = getCollection(client, context.auth.database, collectionName);
            const result = await collection[operation](JSON.parse(query));
            let documents = result;
            if (operation != 'findOne') {
                documents = await result.limit(1000).toArray();
            }
            await context.sendJson({ documents }, 'out');
        } finally {
            await client.close();
        }
    }
};

