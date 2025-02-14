'use strict';

const { generateAuthorizationHeader } = require('./signature');

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            hostnameUrl: {
                type: 'text',
                name: 'Hostname URL',
                tooltip: 'Expected value: akab-abc123.luna.akamaiapis.net'
            },
            accessToken: {
                type: 'text',
                name: 'Access Token',
                tooltip: ''
            },
            clientToken: {
                type: 'text',
                name: 'Client Token',
                tooltip: ''
            },
            clientSecret: {
                type: 'text',
                name: 'Client Secret',
                tooltip: ''
            }
        },

        validate: async context => {
            let { hostnameUrl } = context;
            if (hostnameUrl.contains('http')) {
                hostnameUrl = hostnameUrl.replace(/^http?:\/\//, '');
            } else {
                hostnameUrl = hostnameUrl.replace(/^https?:\/\//, '');
            }
            hostnameUrl.replace(/\/$/, '');

            const { url, method, headers: { Authorization } } = generateAuthorizationHeader(
                {
                    hostnameUrl,
                    accessToken: context.accessToken,
                    clientToken: context.clientToken,
                    clientSecret: context.clientSecret,
                    method: 'GET',
                    path: '/identity-management/v3/user-profile'
                }
            );

            const { status } = await context.httpRequest({ url, method, headers: { Authorization } });

            return status === 200;
        },

        accountNameFromProfileInfo: async (context) => {
            const { url, method, headers: { Authorization } } = generateAuthorizationHeader(
                {
                    hostnameUrl: context.hostnameUrl,
                    accessToken: context.accessToken,
                    clientToken: context.clientToken,
                    clientSecret: context.clientSecret,
                    method: 'GET',
                    path: '/identity-management/v3/user-profile'
                }
            );

            const { data } = await context.httpRequest({ url, method, headers: { Authorization } });

            return data.uiUserName;
        }
    }
};
