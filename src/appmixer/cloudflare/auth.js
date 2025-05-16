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
                name: 'API Token or Global API Key (deprecated)',
                tooltip: 'Enter your API Token or Global API Key (deprecated).'
            }
        },

        requestProfileInfo: async function(context) {

            const { email, apiKey } = context;
            return { account: email || apiKey.substring(0, 5) + '...' + apiKey.slice(-3) };
        },

        validate: async function(context) {

            const { email, apiKey } = context;
            const client = new CloudflareAPI({ email, apiKey });
            const { data } = await client.verify(context);
            return data.success || false;
        }
    }
};
