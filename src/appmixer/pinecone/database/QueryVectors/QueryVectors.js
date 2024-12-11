'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    async receive(context) {

        const {
            index,
            namespace,
            vector,
            topK,
            filter,
            includeValues,
            includeMetadata,
            aggregateMetadataField
        } = context.messages.in.content;

        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        const pineconeIndex = await pinecone.index(index);

        const query = {
            vector: typeof vector === 'string' ? JSON.parse(vector) : vector,
            filter: typeof filter === 'string' ? JSON.parse(filter) : filter,
            topK: topK || 10,
            includeValues,
            includeMetadata: aggregateMetadataField ? true : includeMetadata
        };

        const result = await pineconeIndex.namespace(namespace).query(query);

        const out = { result };
        if (aggregateMetadataField) {
            const aggregatedMetadata = result.matches.reduce((acc, { metadata }) => {
                const value = metadata[aggregateMetadataField];
                return acc + (acc ? '\n' : '') + value;
            }, '');
            out.aggregatedMetadata = aggregatedMetadata;
        }

        return context.sendJson(out, 'out');
    }
};
