'use strict';

const { API_VERSION } = require('./lib');

module.exports = {
    type: 'oauth2',

    definition: () => {
        const apiVersion = API_VERSION; //api version from lib.js;
        return {
            accountNameFromProfileInfo: 'name',

            authUrl: 'https://api.notion.com/v1/oauth/authorize',

            requestAccessToken: async (context) => {
                const encoded = Buffer.from(`${context.clientId}:${context.clientSecret}`).toString('base64');

                const { data } = await context.httpRequest({
                    url: 'https://api.notion.com/v1/oauth/token',
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${encoded}`,
                        'Content-Type': 'application/json'
                    },
                    data: {
                        grant_type: 'authorization_code',
                        redirect_uri: context.callbackUrl,
                        code: context.authorizationCode
                    }
                });

                return {
                    accessToken: data['access_token']
                };
            },

            requestProfileInfo: {
                method: 'GET',
                url: 'https://api.notion.com/v1/users/me',
                headers: {
                    Authorization: 'Bearer {{accessToken}}',
                    'User-Agent': 'AppMixer',
                    'Notion-Version': apiVersion
                }
            },

            validateAccessToken: {
                method: 'GET',
                url: 'https://api.notion.com/v1/users/me',
                headers: {
                    Authorization: 'Bearer {{accessToken}}',
                    'User-Agent': 'AppMixer',
                    'Notion-Version': apiVersion
                }
            }
        };
    }
};
