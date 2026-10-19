'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            baseUrl: {
                type: 'text',
                name: 'Base URL',
                tooltip: 'Enter your Datashopper base URL (e.g., https://main.dashboard.datashopper.com)'
            },
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your Datashopper API Key. You can find it in your Datashopper account settings.'
            }
        },

        accountNameFromProfileInfo: (context) => {
            const apiKey = context.apiKey;
            return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
        },

        validate: async (context) => {
            // Test the API key by making a request to the websites endpoint
            const response = await context.httpRequest({
                method: "GET",
                url: `${context.baseUrl}/api/v2/appmixer/verify`,
                headers: {
                    "X-API-Key": context.apiKey,
                    "Content-Type": "application/json",
                },
            });

            if (response.data.success) {
                return true;
            } else {
                throw new Error('Authentication Failed: Invalid API key');
            }
        }
    }
};
