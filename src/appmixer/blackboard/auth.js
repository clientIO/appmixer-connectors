'use strict';
const Blackboard = require('./sdk');
const add = require('date-fns/add');

module.exports = {

    type: 'oauth2',

    definition: initData => {

        return {

            accountNameFromProfileInfo: function(context) {

                return context.profileInfo.userName;
            },

            authUrl: function(context) {

                const blackboard = new Blackboard(
                    context.clientId,
                    context.clientSecret,
                    context.config.serverUrl,
                    context.callbackUrl,
                    context.httpRequest
                );

                return blackboard.getAuthUrl(context.ticket);
            },

            async requestProfileInfo(context) {

                const blackboard = new Blackboard(
                    context.clientId,
                    context.clientSecret,
                    context.config.serverUrl,
                    context.callbackUrl,
                    context.httpRequest
                );
                blackboard.setAccessToken(context.accessToken);
                return blackboard.callApi('get', '/v1/users/me');
            },

            async requestAccessToken(context) {

                const blackboard = new Blackboard(
                    context.clientId,
                    context.clientSecret,
                    context.config.serverUrl,
                    context.callbackUrl,
                    context.httpRequest
                );
                const data = await blackboard.requestAccessToken(context.authorizationCode);
                return {
                    accessToken: data['access_token'],
                    accessTokenExpDate: add(new Date(), { seconds: data['expires_in'] }),
                    refreshToken: data['refresh_token']
                };
            },

            async refreshAccessToken(context) {

                const blackboard = new Blackboard(
                    context.clientId,
                    context.clientSecret,
                    context.config.serverUrl,
                    context.callbackUrl,
                    context.httpRequest
                );
                const data = await blackboard.refreshToken(context.refreshToken);
                return {
                    accessToken: data['access_token'],
                    accessTokenExpDate: add(new Date(), { seconds: data['expires_in'] }),
                    refreshToken: data['refresh_token']
                };
            },

            validateAccessToken: function(context) {

                const blackboard = new Blackboard(
                    context.clientId,
                    context.clientSecret,
                    context.config.serverUrl,
                    context.callbackUrl,
                    context.httpRequest
                );
                blackboard.setAccessToken(context.accessToken);
                return blackboard.callApi('get', '/v1/users/me');
            }
        };
    }
};
