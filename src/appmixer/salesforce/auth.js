'use strict';

const crypto = require('crypto');

/**
 * PKCE (RFC 7636) code verifier derived from the OAuth ticket. Salesforce
 * requires PKCE for External Client Apps (and enforces it progressively for
 * Connected Apps), so the authorize request has to carry a code_challenge
 * and the token request the matching code_verifier. The ticket is the only
 * value that survives between authUrl() and requestAccessToken(), so the
 * verifier is derived from it deterministically: base64url(sha256(ticket))
 * is 43 characters, which is the minimum verifier length Salesforce accepts.
 */
const getCodeVerifier = ticket => crypto.createHash('sha256').update(ticket).digest('base64url');

const getCodeChallenge = codeVerifier => crypto.createHash('sha256').update(codeVerifier).digest('base64url');

module.exports = {

    type: 'oauth2',

    definition: () => {

        let instanceId = null;
        let instanceUrl = null;

        return {

            authUrl(context) {

                const { baseUrl = 'https://login.salesforce.com' } = context.authConfig;

                const promptType = context.authConfig.promptType || 'login';

                const url = new URL('/services/oauth2/authorize', baseUrl);
                const queryParams = {
                    response_type: 'code',
                    client_id: context.clientId,
                    redirect_uri: context.callbackUrl,
                    state: context.ticket,
                    prompt: promptType,
                    code_challenge: getCodeChallenge(getCodeVerifier(context.ticket)),
                    code_challenge_method: 'S256'
                };
                url.search = new URLSearchParams(queryParams);

                return url.toString();
            },

            accountNameFromProfileInfo: 'email',

            requestAccessToken: async context => {

                const { baseUrl = 'https://login.salesforce.com' } = context.authConfig;

                const url = new URL('/services/oauth2/token', baseUrl);

                const queryParams = {
                    grant_type: 'authorization_code',
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    client_id: context.clientId,
                    client_secret: context.clientSecret,
                    // Same verifier the code_challenge in authUrl() was built from.
                    code_verifier: getCodeVerifier(context.ticket)
                };
                url.search = new URLSearchParams(queryParams);

                const tokenUrl = url.toString();

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: tokenUrl
                });

                //token has no expiration date but there is timeout for session timeout
                //default value is 2hrs
                const newDate = new Date();
                newDate.setSeconds(newDate.getSeconds() + 60 * 120);
                instanceId = data['id'];
                instanceUrl = data['instance_url'];

                return {
                    accessToken: data['access_token'],
                    refreshToken: data['refresh_token'],
                    accessTokenExpDate: newDate
                };
            },

            requestProfileInfo: async context => {

                if (!instanceId || !instanceUrl) {
                    // The identity URL and instance URL normally come from the
                    // requestAccessToken closure. When the account is created from
                    // pre-obtained tokens (token import via the accounts API), that
                    // closure state is empty — recover both from the OAuth userinfo
                    // endpoint instead.
                    const { baseUrl = 'https://login.salesforce.com' } = context.authConfig;
                    const { data: userinfo } = await context.httpRequest({
                        method: 'GET',
                        url: new URL('/services/oauth2/userinfo', baseUrl).toString(),
                        headers: {
                            'Authorization': `Bearer ${context.accessToken}`
                        }
                    });
                    const restUrl = userinfo['urls'] && userinfo['urls']['rest'];
                    if (!userinfo['sub'] || !restUrl) {
                        // The urls claim requires the connected app to have the
                        // `profile`/`full` scope; without it we cannot derive the
                        // instance URL from the token alone.
                        throw new Error('Salesforce userinfo response is missing the "sub"/"urls" claims. '
                            + 'Grant the connected app the "profile" (or "full") scope, or create the account '
                            + 'through the standard OAuth flow.');
                    }
                    instanceId = userinfo['sub'];
                    instanceUrl = new URL(restUrl).origin;
                }

                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: instanceId,
                    headers: {
                        'Authorization': `Bearer ${context.accessToken}`
                    }
                });

                return { instanceUrl, instanceId, email: data['email'] };
            },

            refreshAccessToken: async context => {

                const { baseUrl = 'https://login.salesforce.com' } = context.authConfig;

                const url = new URL('/services/oauth2/token', baseUrl);

                const queryParams = {
                    grant_type: 'refresh_token',
                    refresh_token: context.refreshToken,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                };
                url.search = new URLSearchParams(queryParams);

                const tokenRefreshUrl = url.toString();

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: tokenRefreshUrl
                });

                const newDate = new Date();
                newDate.setSeconds(newDate.getSeconds() + 60 * 120);
                instanceId = data['id'];
                instanceUrl = data['instance_url'];
                const refreshed = {
                    accessToken: data['access_token'],
                    accessTokenExpDate: newDate
                };
                // Apps with Refresh Token Rotation enabled (enforced by Salesforce
                // together with PKCE) return a new refresh token and invalidate the
                // old one, so it has to be stored or the next refresh fails.
                if (data['refresh_token']) {
                    refreshed.refreshToken = data['refresh_token'];
                }
                return refreshed;
            },

            validateAccessToken: context => {

                return context.accessTokenExpDate > new Date();
            }
        };
    }
};
