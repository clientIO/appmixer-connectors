'use strict';

const { Pinecone } = require('@pinecone-database/pinecone');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Log into your Pinecone account and find <i>API Keys</i> page.'
                }
            },

            validate: async (context) => {
                const pinecone = new Pinecone({
                    apiKey: context.apiKey
                });
                await pinecone.listIndexes();
                return true;
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
            }
        };
    }
};
