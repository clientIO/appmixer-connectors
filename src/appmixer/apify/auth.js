'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API Key.'
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
            // Example validation: make a GET request to a generic endpoint
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.example.com/v1/profile',
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });
            if (!response.data || !response.data.id) {
                throw new Error('Authentication failed: Invalid API Key');
            }
            return true;
        }
    }
};
