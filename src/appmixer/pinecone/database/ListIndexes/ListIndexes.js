'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    async receive(context) {

        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        const response = await pinecone.listIndexes();
        return context.sendJson({ indexes: response.indexes }, 'out');
    },

    toSelectArray(out) {
        return (out.indexes || []).map(index => ({ label: index.name + ' [' + index.dimension + ']', value: index.name }));
    }
};
