'use strict';
const axios = require('axios');
const { URL } = require('url');
const { URLSearchParams } = require('url');
const FormData = require('form-data');

module.exports = {

    type: 'oauth2',

    definition: () => {

        let userId = null;
        let teamName = null;

        return {

            accountNameFromProfileInfo: 'id',

            authUrl: context => {

                let urlObject = new URL('https://slack.com/oauth/v2/authorize');
                let params = new URLSearchParams([
                    ['client_id', context.clientId],
                    ['redirect_uri', context.callbackUrl],
                    ['state', context.ticket]
                ]);
                if (Array.isArray(context.scope) && context.scope.length > 0) {
                    // this is the reason, why 'authUrl' is implemented in this auth.js module, in order to
                    // get user token and not a bot token, the scope has to be in the 'user_scope' param and
                    // not in the default Oauth2 'scope' param.
                    context.scope.push('groups:history');
                    params.append('user_scope', context.scope.join(','));
                }
                urlObject.search = params;
                return urlObject.toString();
            },

            requestAccessToken: context => {

                const form = new FormData();
                form.append('code', context.authorizationCode);
                form.append('grant_type', 'authorization_code');
                form.append('redirect_uri', context.callbackUrl);
                form.append('client_id', context.clientId);
                form.append('client_secret', context.clientSecret);

                return axios.post(
                    'https://slack.com/api/oauth.v2.access',
                    form,
                    { headers: form.getHeaders() }
                ).then(response => {
                    if (!response.data) {
                        throw new Error(response.status);
                    }
                    if (!response.data.ok) {
                        throw new Error(response.data.error);
                    }
                    userId = response.data['authed_user']['id'];
                    teamName = response.data['team']['name'];
                    return {
                        accessToken: response.data['authed_user']['access_token'],
                        refreshToken: null
                    };
                });
            },

            requestProfileInfo: async context => {

                return {
                    'id': userId + (teamName ? ' - ' + teamName : '')
                        || Math.random().toString().replace('0.', '')
                };
            },

            validateAccessToken: context => {

                return axios({
                    method: 'POST',
                    url: 'https://slack.com/api/auth.test',
                    headers: {
                        'Authorization': `Bearer ${context.accessToken}`
                    },
                    json: true

                }).then(response => {
                    if (!response.data) {
                        throw new Error(response.status);
                    }
                    if (response.data.ok) {
                        return;
                    }
                    const invalidTokenErrors = [
                        'invalid_auth',
                        'account_inactive',
                        'token_revoked',
                        'no_permission'
                    ];
                    if (invalidTokenErrors.indexOf(response.data.error) !== -1) {
                        throw new context.InvalidTokenError(response.data.error);
                    }
                    throw new Error(response.data.error);
                });
            }
        };
    }
};
