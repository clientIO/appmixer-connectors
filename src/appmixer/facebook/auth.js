'use strict';
const graph = require('fbgraph');

module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['public_profile', 'email'],

        authUrl: context => {

            return graph.getOauthUrl({
                'client_id': context.clientId,
                'redirect_uri': context.callbackUrl,
                'scope': context.scope.join(', '),
                'state': context.ticket
            });
        },

        requestAccessToken: context => {

            return new Promise((resolve, reject) => {
                graph.authorize({
                    'client_id': context.clientId,
                    'redirect_uri': context.callbackUrl,
                    'client_secret': context.clientSecret,
                    'code': context.authorizationCode
                }, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (result['expires_in'] * 1000));
                    resolve({
                        accessToken: result['access_token'],
                        accessTokenExpDate: newDate
                    });
                });
            });
        },

        accountNameFromProfileInfo: context => {

            return context.profileInfo['name'] || context.profileInfo['id'].toString();
        },

        requestProfileInfo: context => {

            return new Promise((resolve, reject) => {
                graph.setAccessToken(context.accessToken);
                graph.setAppSecret(context.clientSecret);
                graph.batch([{
                    method: 'GET',
                    'relative_url': 'me'    // Get the current user's profile information
                }], (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    try {
                        resolve(JSON.parse(res[0]['body']));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        },

        refreshAccessToken: context => {

            return new Promise((resolve, reject) => {
                graph.extendAccessToken({
                    'access_token': context.accessToken,
                    'client_id': context.clientId,
                    'client_secret': context.clientSecret
                }, (err, result) => {
                    if (err) {
                        if (err.type === 'OAuthException') {
                            return reject(new context.InvalidTokenError(err.message));
                        }
                        return reject(err);
                    }
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (result['expires_in'] * 1000));
                    resolve({
                        accessToken: result['access_token'],
                        accessTokenExpDate: newDate
                    });
                });
            });
        },

        validateAccessToken: context => {

            return new Promise((resolve, reject) => {
                graph.setAccessToken(context.accessToken);
                graph.setAppSecret(context.clientSecret);
                graph.batch([{
                    method: 'GET',
                    'relative_url': 'me'
                }], (err, res) => {
                    if (err && err.type === 'OAuthException') {
                        return reject(new context.InvalidTokenError(err.message));
                    }
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        }
    }
};
