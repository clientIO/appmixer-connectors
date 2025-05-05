'use strict';

module.exports = {

    name: 'appmixer:ai:voyageai',

    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your dashboard at https://dashboard.voyageai.com/api-keys to create an API key.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 3) + '...' + apiKey.substr(apiKey.length - 4)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: (context) => {
            // TODO: Add validation for the API key once VoyageAI provides a way to validate it.
            if (!context.apiKey) {
                throw new Error('API Key is required.');
            }
            return true;
        }
    }
};
