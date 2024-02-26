'use strict';

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['profile', 'email', 'openid'],

        scopeDelimiter: ' ',

        accountNameFromProfileInfo: context => {

            return (((context.profileInfo.given_name + ' ') || '') + context.profileInfo.family_name) || context.profileInfo.email;
        },

        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',

        requestAccessToken: 'https://www.linkedin.com/oauth/v2/accessToken',

        refreshAccessToken: context => {

            throw new context.InvalidTokenError('LinkedIn does not support refresh tokens, you have to authorize again.');
        },

        requestProfileInfo: {
            method: 'GET',
            url: 'https://api.linkedin.com/v2/userinfo',
            auth: {
                bearer: '{{accessToken}}'
            }
        },

        validateAccessToken: {
            method: 'GET',
            url: 'https://api.linkedin.com/v2/userinfo',
            auth: {
                bearer: '{{accessToken}}'
            }
        }
    }
};
