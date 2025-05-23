'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Log into your OpenRouter account and find <i>Keys</i> page in the Settings.'
                }
            },

            validate: async (context) => {

                return lib.request(context, 'get', '/models');
            },

            accountNameFromProfileInfo: (context) => {
                const apiKey = context.apiKey;
                return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
            }
        };
    }
};
