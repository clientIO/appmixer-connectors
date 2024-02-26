'use strict';
const request = require('request-promise');

module.exports = {

    type: 'oauth2',

    definition: () => {

        let profileInfo;

        return {

            accountNameFromProfileInfo: context => {

                return context.profileInfo['email'] || context.profileInfo['id'].toString();
            },

            authUrl: 'https://app.asana.com/-/oauth_authorize',

            requestAccessToken: context => {

                // don't put params into post body, won't work, have to be in query
                let tokenUrl = 'https://app.asana.com/-/oauth_token?' +
                    'grant_type=authorization_code&code=' + context.authorizationCode +
                    '&redirect_uri=' + context.callbackUrl +
                    '&client_id=' + context.clientId +
                    '&client_secret=' + context.clientSecret;

                return request({
                    method: 'POST',
                    url: tokenUrl,
                    json: true
                }).then(result => {
                    profileInfo = result['data'];
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (result['expires_in'] * 1000));
                    return {
                        accessToken: result['access_token'],
                        refreshToken: result['refresh_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            requestProfileInfo: () => {

                return profileInfo;
            },

            refreshAccessToken: context => {

                // don't put params into post body, won't work, have to be in query
                let tokenUrl = 'https://app.asana.com/-/oauth_token?' +
                    'grant_type=refresh_token&refresh_token=' + context.refreshToken +
                    '&redirect_uri=' + context.callbackUrl +
                    '&client_id=' + context.clientId +
                    '&client_secret=' + context.clientSecret;

                return request({
                    method: 'POST',
                    url: tokenUrl,
                    json: true
                }).then(result => {
                    profileInfo = result['data'];
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (result['expires_in'] * 1000));
                    return {
                        accessToken: result['access_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            validateAccessToken: {
                method: 'GET',
                url: 'https://app.asana.com/api/1.0/users/me',
                auth: {
                    bearer: '{{accessToken}}'
                }
            }
        };
    }
};
