'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

const BATCH_SIZE = 200;

module.exports = {

    async receive(context) {

        const {
            index,
            namespace,
            vectors
        } = context.messages.in.content;

        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        const pineconeIndex = await pinecone.index(index);

        const normalizedVectors = typeof vectors === 'string' ? JSON.parse(vectors) : vectors;

        for (let i = 0; i < normalizedVectors.length; i += BATCH_SIZE) {
            const batch = normalizedVectors.slice(i, i + BATCH_SIZE);
            await context.log({ step: 'upsert-batch', batchLength: batch.length, batchIndex: i, vectorsLength: normalizedVectors.length });
            await pineconeIndex.namespace(namespace).upsert(batch);
        }

        return context.sendJson({ upsertedCount: normalizedVectors.length }, 'out');
    }
};
