'use strict';

module.exports = {
    type: 'apiKey',
    definition: {
        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your SendGrid API key. You can find it in your SendGrid dashboard under Settings > API Keys.'
            }
        },

        accountNameFromProfileInfo: 'apiKey',

        requestProfileInfo: async (context) => {
            return {
                apiKey: `${context.apiKey.substring(0, 8)}...${context.apiKey.substring(context.apiKey.length - 4)}`
            };
        },

        validate: async (context) => {
            await context.httpRequest({
                method: 'GET',
                url: 'https://api.sendgrid.com/v3/marketing/lists',
                headers: {
                    'Authorization': `Bearer ${context.apiKey}`
                }
            });

            return true;
        }
    }
};
