'use strict';
const commons = require('./docusign-commons');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['signature'],

        accountNameFromProfileInfo: context => {

            return context.profileInfo.name;
        },

        scopeDelimiter: ' ',
        authUrl: 'https://account-d.docusign.com/oauth/auth',

        requestAccessToken: async context => {

            const { clientId, clientSecret, authorizationCode } = context;
            const tokenResponse = await commons.getAccessToken(clientId, clientSecret, authorizationCode, context);
            let newDate = new Date();
            newDate.setTime(newDate.getTime() + (tokenResponse['expires_in'] * 1000));

            return {
                accessToken: tokenResponse['access_token'],
                refreshToken: tokenResponse['refresh_token'],
                accessTokenExpDate: newDate
            };
        },
        requestProfileInfo: 'https://account-d.docusign.com/oauth/userinfo'
    }
};
