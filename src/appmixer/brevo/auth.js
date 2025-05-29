'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Brevo (formerly Sendinblue) account and find your API key in the SMTP & API section.'
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
            // Brevo API: https://api.brevo.com/v3/account
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://api.brevo.com/v3/account',
                headers: {
                    'api-key': context.apiKey,
                    'accept': 'application/json'
                }
            });
            if (!response.data || !response.data.email) {
                throw new Error('Authentication failed: Invalid API key or unexpected response.');
            }
            return true;
        }
    }
};
