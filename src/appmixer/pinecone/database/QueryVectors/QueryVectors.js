'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');
const jsonata = require('jsonata');

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
            transformation
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
            includeMetadata: transformation ? true : includeMetadata
        };

        const result = await pineconeIndex.namespace(namespace).query(query);

        const out = { result, transformedResult: result };
        if (transformation && result) {
            out.transformedResult = await jsonata(transformation).evaluate(result);
        }

        return context.sendJson(out, 'out');
    }
};
