'use strict';
// const { makeRequest, requestAccessToken, getBaseUrl } = require('../commons');


module.exports = {

    type: 'oauth2',

    definition: () => {

        return {

            scope: [
                'openid',
                'profile',
                'email',
                'offline_access',
                'accounting.settings.read'
            ],

            scopeDelimiter: ' ',

            authUrl: 'https://login.xero.com/identity/connect/authorize',

            requestAccessToken: 'https://identity.xero.com/connect/token',

            refreshAccessToken: 'https://identity.xero.com/connect/token',

            requestProfileInfo: async context => {

                const { data } = await context.httpRequest({
                    url: 'https://identity.xero.com/connect/userinfo',
                    method: 'GET',
                    headers: {
                        authorization: `Bearer ${context.accessToken}`,
                        accept: 'application/json'
                    }
                });


                await context.log({ 'step': 'auth', data });
                // Auth Hub runs requestProfileInfo from its own copy of this connector, while the
                // tenant evaluates accountNameFromProfileInfo from its copy. Tenants older than 1.6.1
                // read `EmailAddress` (the former /Users profile), so keep that key too.
                return { ...data, EmailAddress: data.email };
            },

            // Fall back to `EmailAddress` for an Auth Hub still running the pre-1.6.1 profile.
            accountNameFromProfileInfo: context => {
                return context.profileInfo.email || context.profileInfo.EmailAddress;
            }
        };
    }
};
