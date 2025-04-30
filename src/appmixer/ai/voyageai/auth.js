'use strict';

module.exports = {

    name: 'appmixer:ai:voyageai',

    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your service account and find <i>API Keys</i> page.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 13) + '...' + apiKey.substr(apiKey.length - 9)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: (context) => {
            if (!context.apiKey) {
                throw new Error('API Key is required.');
            }
            return true;
        }
    }
};
