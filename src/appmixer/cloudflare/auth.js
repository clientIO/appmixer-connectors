'use strict';

const CloudflareAPI = require('./CloudflareAPI');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            email: {
                type: 'text',
                name: 'Email',
                tooltip: 'Enter your "Email". Required only for Global API Key authentication.'
            },
            apiKey: {
                type: 'text',
                name: 'Global API Key or API Token',
                tooltip: 'Enter your Global API Key or API Token.'
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
            const client = new CloudflareAPI({ email, apiKey });
            const { data } = await client.verifyGlobalApiKey(context);
            return data.success || false;
        }
    }
};
