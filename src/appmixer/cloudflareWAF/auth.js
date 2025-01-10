'use strict';

const CloudflareAPI = require('../CloudflareAPI');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'account',

        auth: {
            apiToken: {
                type: 'text',
                name: 'API Token',
                tooltip: 'Manage access and permissions for your accounts, sites, and products".'
            }
        },

        requestProfileInfo: async function(context) {

            const { apiToken } = context;

            const threshold = 10;
            if (apiToken.length > threshold) {
                return { account: apiToken.slice(0, 5) + ' ... ' + apiToken.slice(-3) };
            }
        },

        validate: async function(context) {

            const client = new CloudflareAPI({ token: context.apiToken });
            const { data } = await client.verify(context);
            return data.success || false;
        }
    }
};
