'use strict';

const request = require('request-promise');

module.exports = {

    type: 'oauth2',

    definition: {

        accountNameFromProfileInfo: 'email',

        scope: 'basic devices_read devices_write',

        authUrl: 'https://developer.lametric.com/api/v2/oauth2/authorize/',

        requestAccessToken: 'https://developer.lametric.com/api/v2/oauth2/token',

        requestProfileInfo: {
            'method': 'GET',
            'uri': 'https://developer.lametric.com/api/v2/users/me',
            'headers': {
                'authorization': 'Bearer {{accessToken}}'
            }
        },

        refreshAccessToken: context => {

            // don't put params into post body, won't work, have to be in query
            let tokenUrl = 'https://developer.lametric.com/api/v2/oauth2/token?' +
                'grant_type=refresh_token&refresh_token=' + context.refreshToken +
                '&redirect_uri=' + context.callbackUrl +
                '&client_id=' + context.clientId +
                '&client_secret=' + context.clientSecret;

            return request({
                method: 'POST',
                url: tokenUrl,
                json: true
            }).then(result => {
                let newDate = new Date();
                newDate.setTime(newDate.getTime() + (result['expires_in'] * 1000));
                return {
                    accessToken: result['access_token'],
                    accessTokenExpDate: newDate
                };
            });
        },

        validate: {
            'method': 'GET',
            'uri': 'https://developer.lametric.com/api/v2/users/me',
            'headers': {
                'authorization': 'Bearer {{accessToken}}'
            }
        }
    }
};
