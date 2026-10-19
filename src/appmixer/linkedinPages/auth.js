'use strict';

// LinkedIn Pages uses its own LinkedIn developer app with the Community Management API product.
// That product cannot share an app with "Sign In with LinkedIn using OpenID Connect", so there is
// no `openid` scope here: the member profile comes from /v2/me (r_basicprofile) and has no email.

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const PROFILE_URL = 'https://api.linkedin.com/v2/me';

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['r_basicprofile'],

        scopeDelimiter: ' ',

        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',

        requestAccessToken: TOKEN_URL,

        accountNameFromProfileInfo: context => {

            const { localizedFirstName, localizedLastName, vanityName, id } = context.profileInfo || {};
            const name = [localizedFirstName, localizedLastName].filter(Boolean).join(' ');
            return name || vanityName || id;
        },

        requestProfileInfo: {
            method: 'GET',
            url: PROFILE_URL,
            auth: {
                bearer: '{{accessToken}}'
            }
        },

        // LinkedIn issues refresh tokens only to some apps. The refresh token keeps its original
        // one-year expiry, so it is reused when the response does not return a new one.
        refreshAccessToken: async context => {

            let refreshToken = null;
            try {
                refreshToken = context.refreshToken;
            } catch (err) {
                // The engine throws when the account has no refresh token.
            }
            if (!refreshToken) {
                throw new context.InvalidTokenError(
                    'The LinkedIn access token expired and LinkedIn did not issue a refresh token. Reconnect the account.'
                );
            }

            let data;
            try {
                ({ data } = await context.httpRequest({
                    method: 'POST',
                    url: TOKEN_URL,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                        client_id: context.clientId,
                        client_secret: context.clientSecret
                    }).toString()
                }));
            } catch (err) {
                const status = err.response && err.response.status;
                if (status === 400 || status === 401) {
                    // Expired (after a year) or revoked refresh token.
                    const body = err.response.data || {};
                    const detail = body.error_description || body.error;
                    throw new context.InvalidTokenError(
                        'LinkedIn refused to refresh the access token. Reconnect the account.' +
                        (detail ? ` LinkedIn says: ${detail}` : '')
                    );
                }
                throw err;
            }

            return {
                accessToken: data.access_token,
                accessTokenExpDate: new Date(Date.now() + data.expires_in * 1000),
                refreshToken: data.refresh_token || refreshToken
            };
        },

        validateAccessToken: {
            method: 'GET',
            url: PROFILE_URL,
            auth: {
                bearer: '{{accessToken}}'
            }
        }
    }
};
