'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Service account and find <i>API Keys</i> page.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate() {
            return true;
        }
    }
};
