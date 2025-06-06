'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your EverArt account and find your API Key.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 3) + '...' + apiKey.substr(4)
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.everart.ai/v1/models?limit=1',
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });

            if (!data.success) {
                throw new Error('Authentication failed: Invalid API Key or unexpected response.');
            }
            return true;
        }
    }
};
