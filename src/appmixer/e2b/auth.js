'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your E2B account and create an API key at <a href="https://e2b.dev/dashboard?tab=keys" target="_blank">https://e2b.dev/dashboard?tab=keys</a>. API keys are team-scoped.'
            }
        },

        requestProfileInfo: async (context) => {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 4) + '...' + apiKey.substr(-4)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            // Validate the API key by listing running sandboxes.
            await context.httpRequest({
                method: 'GET',
                url: 'https://api.e2b.app/v2/sandboxes',
                headers: {
                    'X-API-Key': context.apiKey
                },
                params: {
                    limit: 1
                }
            });
            return true;
        }
    }
};
