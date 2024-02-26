'use strict';
const request = require('request-promise');

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
                    prompt: promptType
                };
                url.search = new URLSearchParams(queryParams);

                return url.toString();
            },

            accountNameFromProfileInfo: 'email',

            requestAccessToken: context => {

                const { baseUrl = 'https://login.salesforce.com' } = context.authConfig;

                const url = new URL('/services/oauth2/token', baseUrl);

                const queryParams = {
                    grant_type: 'authorization_code',
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl,
                    client_id: context.clientId,
                    client_secret: context.clientSecret
                };
                url.search = new URLSearchParams(queryParams);

                const tokenUrl = url.toString();

                return request({
                    method: 'POST',
                    url: tokenUrl,
                    json: true
                }).then(result => {
                    //token has no expiration date but there is timeout for session timeout
                    //default value is 2hrs
                    let newDate = new Date();
                    newDate.setSeconds(newDate.getSeconds() + 60 * 120);
                    instanceId = result['id'];
                    instanceUrl = result['instance_url'];
                    return {
                        accessToken: result['access_token'],
                        refreshToken: result['refresh_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            requestProfileInfo: context => {

                return request({
                    method: 'GET',
                    url: instanceId,
                    auth: {
                        bearer: context.accessToken
                    },
                    json: true
                }).then(result => {
                    return { instanceUrl: instanceUrl, email: result['email'] };
                });
            },

            refreshAccessToken: context => {

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

                return request({
                    method: 'POST',
                    url: tokenRefreshUrl,
                    json: true
                }).then(result => {
                    let newDate = new Date();
                    newDate.setSeconds(newDate.getSeconds() + 60 * 120);
                    instanceId = result['id'];
                    instanceUrl = result['instance_url'];
                    return {
                        accessToken: result['access_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            validateAccessToken: context => {

                return context.accessTokenExpDate > new Date();
            }
        };
    }
};
