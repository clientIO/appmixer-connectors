'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Stripe dashboard and find your API key in Developers > API keys.'
            }
        },

        async requestProfileInfo(context) {
            const apiKey = context.apiKey;
            return {
                key: apiKey.substr(0, 3) + '...' + apiKey.substr(4)
            };
        },
        accountNameFromProfileInfo: 'key',

        validate: async (context) => {
            // Stripe: GET https://api.stripe.com/v1/account with Bearer auth
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.stripe.com/v1/account',
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });
            if (!response.data || !response.data.id) {
                throw new Error('Authentication failed: Could not retrieve Stripe account info.');
            }
            return true;
        }
    }
};
