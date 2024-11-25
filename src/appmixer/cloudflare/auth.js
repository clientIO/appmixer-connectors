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
                tooltip: 'API Token authentication: This method requires only the API token, Enter you custom token generated in the Cloudflare account. Alternatively, you can use the "Email" and "API Key".'
            },
            email: {
                type: 'text',
                name: 'Email (legacy)',
                tooltip: 'Enter your "Email". For this authentication method, both "Email" and "API Key" has to be entered.'
            },
            apiKey: {
                type: 'text',
                name: 'API Key (legacy)',
                tooltip: 'Enter your "API Key". For this authentication method, both "Email" and "API Key" has to be entered.'
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

            const { email, apiKey, apiToken } = context;
            const client = new ZoneCloudflareClient(email, apiKey, null, apiToken);
            const { data } = await client.verify(context);

            console.log(data);
            return data.success || false;

        }
    }
};
