'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    async receive(context) {

        const { name } = context.messages.in.content;
        const pinecone = new Pinecone({
            apiKey: context.auth.apiKey
        });
        await pinecone.deleteIndex(name);
        return context.sendJson({}, 'out');
    }
};
