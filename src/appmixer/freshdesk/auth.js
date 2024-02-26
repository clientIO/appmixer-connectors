'use strict';
const request = require('request-promise');

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            domain: {
                type: 'text',
                name: 'Domain',
                tooltip: 'Your Freshdesk subdomain - e.g. if the domain is <i>https://example.freshdesk.com</i> just type <b>example</b> inside this field'
            },
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Freshdesk account and find <i>Your API Key</i> in Profile settings page.'
            }
        },

        accountNameFromProfileInfo: 'contact.email',

        requestProfileInfo: async context => {

            // curl https://mydomain.freshdesk.com/api/v2/agents/me \
            //  -u myApiKey:X'
            return request({
                method: 'GET',
                url: `https://${context.domain}.freshdesk.com/api/v2/agents/me`,
                auth: {
                    user: context.apiKey,
                    password: 'X'
                },
                json: true
            });
        },

        validate: async context => {

            // curl https://mydomain.freshdesk.com/api/v2/agents/me \
            //  -u myApiKey:X'
            const credentials = `${context.apiKey}:X`;
            const encoded = (new Buffer(credentials)).toString('base64');
            await request({
                method: 'GET',
                url: `https://${context.domain}.freshdesk.com/api/v2/agents/me`,
                headers: {
                    'Authorization': `Basic ${encoded}`
                }
            });
            // if the request doesn't fail, return true (exception will be captured in caller)
            return true;
        }
    }
};
