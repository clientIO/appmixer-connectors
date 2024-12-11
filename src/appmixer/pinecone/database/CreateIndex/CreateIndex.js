'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    async receive(context) {

        const {
            name,
            dimension,
            metric,
            serverlessCloud,
            serverlessRegion,
            deletionProtection
        } = context.messages.in.content;

        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        const index = await pinecone.createIndex({
            name,
            dimension,
            metric,
            spec: {
                serverless: {
                    cloud: serverlessCloud,
                    region: serverlessRegion
                }
            },
            deletionProtection
        });

        return context.sendJson({ index }, 'out');
    }
};
