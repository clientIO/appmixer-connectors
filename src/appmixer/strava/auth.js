'use strict';

const { API_BASE_URL } = require('./constants');

module.exports = {
    type: 'oauth2',

    definition: {

        scope: [
            'read',
            'activity:read_all',
            'profile:read_all',
            'activity:write'
        ],

        accountNameFromProfileInfo: context => {
            return context.profileInfo.firstname && context.profileInfo.lastname
                ? `${context.profileInfo.firstname} ${context.profileInfo.lastname}`.trim()
                : context.profileInfo.username || `Athlete ${context.profileInfo.id}`;
        },

        emailFromProfileInfo: context => context.profileInfo.email || null,

        authUrl: (context) => {
            const state = context.ticket;

            const authorizationUrl = new URL('https://www.strava.com/oauth/authorize');
            authorizationUrl.searchParams.set('client_id', context.clientId);
            authorizationUrl.searchParams.set('redirect_uri', context.callbackUrl);
            authorizationUrl.searchParams.set('response_type', 'code');
            authorizationUrl.searchParams.set('scope', context.scope.join(','));
            authorizationUrl.searchParams.set('state', state);

            return authorizationUrl.toString();
        },

        requestAccessToken: async (context) => {
            const response = await context.httpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/oauth/token`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    client_id: context.clientId,
                    client_secret: context.clientSecret,
                    code: context.authorizationCode,
                    grant_type: 'authorization_code'
                }
            });

            const data = response.data;
            let accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in || 21600) * 1000);

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate
            };
        },

        refreshAccessToken: async (context) => {
            const response = await context.httpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/oauth/token`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    client_id: context.clientId,
                    client_secret: context.clientSecret,
                    refresh_token: context.refreshToken,
                    grant_type: 'refresh_token'
                }
            });

            const data = response.data;
            let accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in || 21600) * 1000);

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate
            };
        },

        requestProfileInfo: async (context) => {
            const response = await context.httpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/athlete`,
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            });
            return response.data;
        },

        validateAccessToken: async (context) => {
            await context.httpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/athlete`,
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            });
            return true;
        }
    }
};
