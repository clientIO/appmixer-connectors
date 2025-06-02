'use strict';
const service = require('./service.json');
/*
TEST_SERVER_URL=http://localhost:2200 appmixer test auth login blogger/auth.js -c 1038500334679-25o83vj5269qkj67frpgtgs0ndbaq2la.apps.googleusercontent.com -s CJrM6NIQ87qfIrhbYK3tq7Eh -o "https://www.googleapis.com/auth/blogger"
"
*/

module.exports = {
    type: 'oauth2',

    definition: initData => {
        return {
            connectAccountButton: { image: service.icon },
            clientId: initData.clientId,
            clientSecret: initData.clientSecret,

            scope: ['profile', 'email'],

            accountNameFromProfileInfo(context) {
                return context.profileInfo.displayName;
            },

            emailFromProfileInfo(context) {
                return context.profileInfo.email;
            },

            authUrl(context) {
                const params = new URLSearchParams({
                    client_id: initData.clientId,
                    redirect_uri: context.callbackUrl,
                    response_type: 'code',
                    scope: context.scope.join(' '),
                    state: context.ticket,
                    access_type: 'offline',
                    approval_prompt: 'force'
                }).toString();

                return `https://accounts.google.com/o/oauth2/auth?${params}`;
            },

            async requestProfileInfo(context) {
                const response = await context.httpRequest({
                    method: 'GET',
                    url: 'https://www.googleapis.com/blogger/v3/users/self',
                    headers: {
                        Authorization: `Bearer ${context.accessToken}`
                    }
                });

                if (!response.data || !response.data.id) {
                    throw new Error('Failed to retrieve Blogger profile information.');
                }

                return response.data;
            },

            async requestAccessToken(context) {
                const data = {
                    code: context.authorizationCode,
                    client_id: initData.clientId,
                    client_secret: initData.clientSecret,
                    redirect_uri: context.callbackUrl,
                    grant_type: 'authorization_code'
                };

                const response = await context.httpRequest({
                    method: 'POST',
                    url: 'https://oauth2.googleapis.com/token',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data
                });

                return {
                    accessToken: response.data.access_token,
                    accessTokenExpDate: new Date(Date.now() + response.data.expires_in * 1000),
                    refreshToken: response.data.refresh_token
                };
            },

            async refreshAccessToken(context) {
                const data = {
                    client_id: initData.clientId,
                    client_secret: initData.clientSecret,
                    refresh_token: context.refreshToken,
                    grant_type: 'refresh_token'
                };

                const response = await context.httpRequest({
                    method: 'POST',
                    url: 'https://oauth2.googleapis.com/token',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data
                });

                return {
                    accessToken: response.data.access_token,
                    accessTokenExpDate: new Date(Date.now() + response.data.expires_in * 1000)
                };
            },

            async validateAccessToken(context) {
                const response = await context.httpRequest({
                    method: 'GET',
                    url: 'https://www.googleapis.com/oauth2/v2/tokeninfo',
                    params: {
                        access_token: context.accessToken
                    }
                });

                if (response.data.expires_in) {
                    return response.data.expires_in;
                }

                throw new Error('Token validation failed.');
            }
        };
    }
};
