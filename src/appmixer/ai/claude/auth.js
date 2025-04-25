'use strict';

module.exports = {

    name: 'appmixer:ai:claude',

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
                key: apiKey.substr(0, 8) + '...' + apiKey.substr(apiKey.length - 8)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: {
            method: 'GET',
            url: 'https://api.anthropic.com/v1/models',
            headers: {
                'x-api-key': '{{apiKey}}',
                'anthropic-version': '2023-06-01'
            }
        }
    }
};
