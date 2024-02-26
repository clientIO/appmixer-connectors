'use strict';
const Schoology = require('./sdk');

module.exports = {

    type: 'oauth',

    definition: context => {

        return {

            accountNameFromProfileInfo: 'name_display',

            requestRequestToken: async (context) => {

                const {
                    consumerKey,
                    consumerSecret,
                    domain,
                    baseUrl = 'https://api.schoology.com/v1'
                } = context.authConfig;
                const client = new Schoology(consumerKey, consumerSecret, domain, baseUrl,
                    { httpRequest: context.httpRequest });

                const response = await client.getRequestToken();
                const qs = new URLSearchParams(response);

                return {
                    requestToken: qs.get('oauth_token'),
                    requestTokenSecret: qs.get('oauth_token_secret')
                };
            },

            authUrl: context => {

                const {
                    consumerKey,
                    consumerSecret,
                    domain,
                    baseUrl = 'https://api.schoology.com/v1'
                } = context.authConfig;
                const client = new Schoology(consumerKey, consumerSecret, domain, baseUrl,
                    { httpRequest: context.httpRequest });

                client.setRequestToken(context.requestToken);
                client.setRequestTokenSecret(context.requestTokenSecret);

                const callbackUrl = new URL(context.callbackUrl);

                // We just set a fixed protocol in order to use substring method later to omit the protocol from
                // the callbackUrl, since Schoology doesn't accept URLs with protocol
                callbackUrl.protocol = 'http';
                callbackUrl.port = '';

                const transformedCallbackUrl = callbackUrl.toString().substring(7);

                return client.getOAuthURL(transformedCallbackUrl);
            },

            requestProfileInfo: async context => {

                const {
                    consumerKey,
                    consumerSecret,
                    domain,
                    baseUrl = 'https://api.schoology.com/v1'
                } = context.authConfig;
                const client = new Schoology(consumerKey, consumerSecret, domain, baseUrl,
                    { httpRequest: context.httpRequest });

                client.setAccessToken(context.accessToken);
                client.setAccessTokenSecret(context.accessTokenSecret);

                const { api_uid } = await client.apiRequest('get', '/app-user-info');
                return client.apiRequest('get', `/users/${api_uid}`);
            },

            requestAccessToken: async context => {

                const {
                    consumerKey,
                    consumerSecret,
                    domain,
                    baseUrl = 'https://api.schoology.com/v1'
                } = context.authConfig;
                const client = new Schoology(consumerKey, consumerSecret, domain, baseUrl,
                    { httpRequest: context.httpRequest });

                client.setRequestToken(context.requestToken);
                client.setRequestTokenSecret(context.requestTokenSecret);

                const response = await client.getAccessToken();
                const tokensQs = new URLSearchParams(response);

                return {
                    accessToken: tokensQs.get('oauth_token'),
                    accessTokenSecret: tokensQs.get('oauth_token_secret')
                };
            },

            validateAccessToken: async context => {

                const {
                    consumerKey,
                    consumerSecret,
                    domain,
                    baseUrl = 'https://api.schoology.com/v1'
                } = context.authConfig;
                const client = new Schoology(consumerKey, consumerSecret, domain, baseUrl,
                    { httpRequest: context.httpRequest });

                client.setAccessToken(context.accessToken);
                client.setAccessTokenSecret(context.accessTokenSecret);

                await client.apiRequest('get', '/app-user-info');
            }
        };
    }
};
