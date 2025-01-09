'use strict';

const CloudflareListClient = require('./CloudflareListClient');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            email: {
                type: 'text',
                name: 'Email',
                tooltip: 'Enter your "Email".'
            },
            apiKey: {
                type: 'text',
                name: 'Global API Key',
                tooltip: 'Enter your "Global API Key".'
            }
        },

        requestProfileInfo: async function(context) {

            const { email } = context;

            if (email) {
                return { account: email };
            }
        },

        validate: async function(context) {

            const { email, apiKey } = context;
            const client = new CloudflareListClient({ email, apiKey });
            const { data } = await client.verifyGlobalApiKey(context);
            return data.success || false;
        }
    }
};
