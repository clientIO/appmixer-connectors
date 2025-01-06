'use strict';

const ZoneCloudflareClient = require('./ZoneCloudflareClient');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            apiToken: {
                type: 'text',
                name: 'API Token',
                tooltip: 'Manage access and permissions for your accounts, sites, and products".'
            },
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

            const { email, apiToken } = context;

            if (email) {
                return { account: email };
            }

            const threshold = 10;
            if (apiToken.length > threshold) {
                return { account: apiToken.slice(0, 5) + ' ... ' + apiToken.slice(-3) };
            }
        },

        validate: async function(context) {

            const client = new ZoneCloudflareClient({ token: context.apiToken });

            const { data } = await client.verify(context);
            return data.success || false;
        }
    }
};
