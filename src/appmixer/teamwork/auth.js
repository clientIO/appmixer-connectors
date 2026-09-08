'use strict';

let accountURL;

const AUTH_URL = 'https://www.teamwork.com/launchpad/login';
const TOKEN_URL = 'https://www.teamwork.com/launchpad/v1/token.json';

module.exports = {
    type: 'oauth2',

    definition: () => {
        return {
            authUrl: AUTH_URL,
            accountNameFromProfileInfo: 'emailAddress',

            requestAccessToken: async context => {
                const url = TOKEN_URL;

                const payload = {
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                };

                const response = await context.httpRequest({
                    method: 'POST',
                    url: url,
                    json: true,
                    data: JSON.stringify(payload),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                accountURL = response.data.installation['apiEndPoint'];
                return {
                    accessToken: response.data['access_token'],
                }
            },

            requestProfileInfo: async context => {
                const response =  await context.httpRequest({
                    method: 'GET',
                    url: accountURL + '/me.json',
                    headers: {
                        'Authorization': `Bearer ${context.accessToken}`
                    },
                    json: true
                });
                return {
                    emailAddress: response.data.person['email-address'],
                    accountURL: accountURL
                }
            },

            validateAccessToken: async context => {
                const response =  await context.httpRequest({
                    method: 'GET',
                    url: context.profileInfo.accountURL + '/me.json',
                    headers: {
                        'Authorization': `Bearer ${context.accessToken}`
                    },
                    json: true
                });

                return response
            }
        };
    }
};
