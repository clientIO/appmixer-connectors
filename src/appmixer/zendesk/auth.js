'use strict';
const request = require('request-promise');
const zendeskAPI = require('./zendesk-commons');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['read', 'write', 'chat'],

        accountNameFromProfileInfo: context => {

            return context.profileInfo['email'];
        },

        pre: {
            zendeskId: {
                type: 'text',
                name: 'Client ID',
                tooltip: 'Enter your Zendesk client ID',
                required: true
            },
            zendeskSecret: {
                type: 'text',
                name: 'Client Secret',
                tooltip: 'Enter your Zendesk client secret',
                required: true
            },
            subdomain: {
                type: 'text',
                name: 'Subdomain',
                tooltip: 'Your Zendesk subdomain - e.g. if the domain is <i>https://example.zendesk.com</i> just type <b>example</b> inside this field',
                required: true
            }
        },

        authUrl: context => {

            return 'https://www.zopim.com/oauth2/authorizations/new?' +
                'response_type=code&client_id={{zendeskId}}&' +
                `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                `state=${encodeURIComponent(context.ticket)}&scope=${encodeURIComponent(context.scope.join(' '))}&` +
                'subdomain={{subdomain}}';
        },

        requestAccessToken: context => {

            return request({
                method: 'POST',
                url: 'https://www.zopim.com/oauth2/token',
                json: true,
                form: {
                    'code': context.authorizationCode,
                    'grant_type': 'authorization_code',
                    'redirect_uri': context.callbackUrl,
                    'client_id': context.zendeskId,
                    'client_secret': context.zendeskSecret,
                    'scope': context.scope.join(' ')
                }
            }).then(response => {
                return {
                    accessToken: response['access_token'],
                    refreshToken: response['refresh_token']
                };
            });
        },

        requestProfileInfo: context => zendeskAPI.get('agents', context).then(profiles => profiles[0]),

        validateAccessToken: context => zendeskAPI.get('agents', context).then(profiles => profiles[0])
    }
};
