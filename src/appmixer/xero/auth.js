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

                const tenants = await context.httpRequest({
                    url: 'https://api.xero.com/connections',
                    method: 'GET',
                    headers: {
                        authorization: `Bearer ${context.accessToken}`,
                        accept: 'application/json'
                    }
                });

                const tenantId = tenants.data[0].tenantId;

                // Use first tenant to get user info. All tenants should have the same user.
                const { data } = await context.httpRequest({
                    url: 'https://api.xero.com/api.xro/2.0/Users',
                    method: 'GET',
                    headers: {
                        authorization: `Bearer ${context.accessToken}`,
                        'Xero-tenant-id': tenantId,
                        accept: 'application/json'
                    }
                });

                return data.Users[0];
            },

            accountNameFromProfileInfo: 'EmailAddress'
        };
    }
};
