'use strict';

const crypto = require('crypto');

const getBasicAuthHeader = (context) => {
    const credentials = `${context.clientId}:${context.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
};

module.exports = {
    type: 'oauth2',

    definition: {
        accountNameFromProfileInfo: 'profile.display_name',

        scope: [
            'design:permission:write',
            'design:content:read',
            'design:content:write',
            'comment:read',
            'asset:read',
            'asset:write',
            'brandtemplate:meta:read',
            'app:write',
            'folder:read',
            'app:read',
            'profile:read',
            'design:permission:read',
            'folder:write',
            'folder:permission:write',
            'comment:write',
            'folder:permission:read',
            'brandtemplate:content:read'
        ],

        authUrl: (context) => {
            const state = context.ticket;

            const codeVerifier = context.ticket;

            // Hash it using SHA256 and base64url encode
            const codeChallenge = crypto
                .createHash('sha256')
                .update(codeVerifier)
                .digest('base64')
                .replace(/=/g, '')
                .replace(/\+/g, '-')
                .replace(/\//g, '_');

            const authorizationUrl = new URL('https://www.canva.com/api/oauth/authorize');
            authorizationUrl.searchParams.set('code_challenge', codeChallenge);
            authorizationUrl.searchParams.set('code_challenge_method', 'S256');
            authorizationUrl.searchParams.set('state', state);
            authorizationUrl.searchParams.set('client_id', context.clientId);
            authorizationUrl.searchParams.set('redirect_uri', context.callbackUrl);
            authorizationUrl.searchParams.set('response_type', 'code');
            authorizationUrl.searchParams.set('scope', context.scope.join(' '));

            return authorizationUrl.toString();
        },

        requestAccessToken: async (context) => {
            const codeVerifier = context.ticket; // same as in authUrl

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.canva.com/rest/v1/oauth/token',
                headers: {
                    Authorization: `Basic ${getBasicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    client_id: context.clientId,
                    client_secret: context.clientSecret,
                    code_verifier: codeVerifier,
                    grant_type: 'authorization_code'
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
            url: 'https://api.canva.com/rest/v1/users/me/profile',
            headers: {
                Authorization: 'Bearer {{accessToken}}'
            }
        },

        refreshAccessToken: 'https://api.canva.com/rest/v1/oauth/token',

        validateAccessToken: (context) => {
            return context.httpRequest({
                method: 'POST',
                url: 'https://api.canva.com/rest/v1/oauth/introspect',
                headers: {
                    Authorization: `Basic ${getBasicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    token: context.accessToken,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                }
            });
        }
    }
};
