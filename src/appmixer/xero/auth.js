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
                return data;
            },

            accountNameFromProfileInfo: 'email'
        };
    }
};
