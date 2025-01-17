'use strict';
const TENANT = 'common';

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['offline_access', 'user.read'],

        scopeDelimiter: ' ',

        authUrl: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,

        requestAccessToken: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',

        refreshAccessToken: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',

        accountNameFromProfileInfo: (context) => {
            const { profileInfo } = context;
            return profileInfo.displayName.trim() || profileInfo.userPrincipalName.trim() || profileInfo.id;
        },

        emailFromProfileInfo: 'mail',

        requestProfileInfo: 'https://graph.microsoft.com/v1.0/me',

        validateAccessToken: {
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me',
            auth: {
                bearer: '{{accessToken}}'
            }
        }
    }
};
