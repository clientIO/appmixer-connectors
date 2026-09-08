'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into the Airtop Developer Portal at '
                    + '<a href="https://portal.airtop.ai/" target="_blank">https://portal.airtop.ai/</a> '
                    + 'and create an API key there.'
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
            // Validate the API key by listing sessions - read-only and does not spend session minutes.
            await context.httpRequest({
                method: 'GET',
                url: 'https://api.airtop.ai/api/v1/sessions',
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                },
                params: {
                    limit: 1
                }
            });
            return true;
        }
    }
};
