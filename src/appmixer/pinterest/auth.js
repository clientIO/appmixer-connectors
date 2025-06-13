'use strict';

const getBasicAuthHeader = (context) => {
    const credentials = `${context.clientId}:${context.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
};

module.exports = {
    type: 'oauth2',

    definition: {
        accountNameFromProfileInfo: 'username',

        scope: [
            'boards:read',
            'boards:write',
            'pins:read',
            'pins:write',
            'user_accounts:read',
            'user_accounts:write',
            'ads:read',
            'ads:write',
            'billing:read',
            'billing:write',
            'catalogs:read',
            'catalogs:write'
        ],

        authUrl: (context) => {
            const authorizationUrl = new URL('https://www.pinterest.com/oauth/');
            authorizationUrl.searchParams.set('client_id', context.clientId);
            authorizationUrl.searchParams.set('redirect_uri', context.callbackUrl);
            authorizationUrl.searchParams.set('response_type', 'code');
            authorizationUrl.searchParams.set('scope', context.scope.join(','));
            authorizationUrl.searchParams.set('state', context.ticket);

            return authorizationUrl.toString();
        },

        requestAccessToken: async (context) => {
            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.pinterest.com/v5/oauth/token',
                headers: {
                    Authorization: `Basic ${getBasicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    grant_type: 'authorization_code',
                    continuous_refresh: true
                }
            });

            let accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in * 1000));

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate
            };
        },

        requestProfileInfo: {
            method: 'GET',
            url: 'https://api.pinterest.com/v5/user_account',
            headers: {
                Authorization: 'Bearer {{accessToken}}'
            }
        },

        refreshAccessToken: async (context) => {
            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.pinterest.com/v5/oauth/token',
                headers: {
                    Authorization: `Basic ${getBasicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    grant_type: 'refresh_token',
                    refresh_token: context.refreshToken
                }
            });

            let accessTokenExpDate = new Date();
            accessTokenExpDate.setTime(accessTokenExpDate.getTime() + (data.expires_in * 1000));

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate
            };
        },

        validateAccessToken: async (context) => {

            return context.httpRequest({
                method: 'GET',
                url: 'https://api.pinterest.com/v5/user_account',
                headers: {
                    Authorization: `Bearer ${context.accessToken}`
                }
            });
        }
    }
};
