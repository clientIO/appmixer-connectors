'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    async receive(context) {

        const {
            index,
            namespace,
            ids,
            deleteAll = false,
            filter,
        } = context.messages.in.content;

        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        const pineconeIndex = await pinecone.index(index);

        let vectors;
        if (typeof ids === 'string') {
            try {
                vectors = JSON.parse(ids);
            } catch (err) {
                vectors = ids;
            }
        } else {
            vectors = ids;
        }

        const query = {
            ids: vectors,
            deleteAll,
            filter: typeof filter === 'string' ? JSON.parse(filter) : filter
        };

        const ns = pineconeIndex.namespace(namespace);

        if (query.ids) {
            if (typeof query.ids === 'string') {
                await ns.deleteOne(query.ids);
            } else {
                await ns.deleteMany(query.ids);
            }
        } else if (query.filter) {
            // Filtering in deleteMan() only works for pod based indexes. However, we want to support all indexes.
            // Therefore, we query vectors based on the filter using topK batches until we reach the end.
            // See https://docs.pinecone.io/guides/data/delete-data#delete-records-in-batches.
            const BATCH = context.config.filterDeleteBatchSize || 1000;
            const INTERVAL = parseInt(context.config.filterDeleteBatchInterval, 10) || 1000; // ms
            const indexInfo = await pinecone.describeIndex(index);
            const queryVector = generateUniformVector(indexInfo.dimension);
            let result = await ns.query({ filter: query.filter, topK: BATCH, vector: queryVector });
            while (result.matches.length > 0) {
                await ns.deleteMany(result.matches.map(match => match.id));
                // Sleep.
                await new Promise(resolve => setTimeout(resolve, INTERVAL));
                result = await ns.query({ filter: query.filter, topK: BATCH, vector: queryVector });
            }
        } else if (query.deleteAll) {
            await ns.deleteAll();
        }
        return context.sendJson({}, 'out');
    }
};

function generateUniformVector(dimensions, min = -1, max = 1) {
    const vector = Array.from({ length: dimensions }, () => {
      return Math.random() * (max - min) + min; // Random float in [min, max)
    });
    return vector;
}