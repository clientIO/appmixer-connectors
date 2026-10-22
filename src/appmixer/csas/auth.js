'use strict';

const DEFAULT_AUTH_BASE_URL = 'https://bezpecnost.csas.cz/api/psd2/fl/oidc/v1';
const DEFAULT_ACCOUNTS_API_BASE_URL = 'https://www.csas.cz/webapi/api/v3/accounts';

const authBaseUrl = (context) => (context.config.authBaseUrl || DEFAULT_AUTH_BASE_URL).replace(/\/+$/, '');
const accountsUrl = (context) => (context.config.accountsApiBaseUrl || DEFAULT_ACCOUNTS_API_BASE_URL).replace(/\/+$/, '') + '/my/accounts';

const expDate = (expiresIn) => {
    const date = new Date();
    date.setSeconds(date.getSeconds() + Number(expiresIn || 0));
    return date;
};

module.exports = {

    type: 'oauth2',

    definition: {

        scope: [],

        scopeDelimiter: ' ',

        authUrl: (context) => {
            const params = new URLSearchParams({
                redirect_uri: context.callbackUrl,
                client_id: context.clientId,
                response_type: 'code',
                access_type: 'offline',
                scope: '',
                prompt: 'consent',
                state: context.ticket
            });
            return authBaseUrl(context) + '/auth?' + params.toString();
        },

        // Telling Appmixer it cannot refresh tokens sooner than 60 seconds before access token expiration
        // (since 5 minutes is default and CSAS access tokens
        // expire in 5 minutes meaning it would always expire before Appmixer would refresh it).
        refreshBeforeExp: 60,
        refreshBeforeExpUnits: 'seconds',

        requestAccessToken: async (context) => {
            const { data } = await context.httpRequest({
                method: 'POST',
                url: authBaseUrl(context) + '/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                }).toString()
            });

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                accessTokenExpDate: expDate(data.expires_in)
            };
        },

        refreshAccessToken: async (context) => {
            const { data } = await context.httpRequest({
                method: 'POST',
                url: authBaseUrl(context) + '/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: context.refreshToken,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                }).toString()
            });

            const token = {
                accessToken: data.access_token,
                accessTokenExpDate: expDate(data.expires_in)
            };
            // Keep the refresh token in sync if the bank rotates it.
            if (data.refresh_token) {
                token.refreshToken = data.refresh_token;
            }
            return token;
        },

        accountNameFromProfileInfo: (context) => {
            return context.profileInfo.displayName;
        },

        requestProfileInfo: async (context) => {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: accountsUrl(context),
                params: { size: 100 },
                headers: {
                    'WEB-API-key': context.config.apiKey,
                    'Authorization': 'Bearer ' + context.accessToken
                }
            });
            const owners = (data.accounts || [])
                .map(account => account.ownersNames || [])
                .flat()
                .filter((value, index, array) => value && array.indexOf(value) === index);
            return {
                displayName: owners.join(', ') || 'Česká spořitelna'
            };
        },

        validateAccessToken: async (context) => {
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: accountsUrl(context),
                    params: { size: 1 },
                    headers: {
                        'WEB-API-key': context.config.apiKey,
                        'Authorization': 'Bearer ' + context.accessToken
                    }
                });
                return true;
            } catch (err) {
                return false;
            }
        }
    }
};
