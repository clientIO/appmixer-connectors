'use strict';
const TwitterApi = require('node-twitter-api');

// NOTES
// Twitter access tokens do not expire

module.exports = {

    type: 'oauth',

    definition: context => {

        let twitterApi = new TwitterApi({
            consumerKey: context.consumerKey,
            consumerSecret: context.consumerSecret,
            callback: context.callbackUrl
        });

        return {

            accountNameFromProfileInfo: 'screen_name',

            requestRequestToken: () => {

                return new Promise((resolve, reject) => {
                    twitterApi.getRequestToken((error, requestToken, requestTokenSecret, results) => {
                        if (error) {
                            return reject(error);
                        }

                        resolve({
                            requestToken: requestToken,
                            requestTokenSecret: requestTokenSecret
                        });
                    });
                });
            },

            authUrl: context => {

                return twitterApi.getAuthUrl(context.requestToken);
            },

            requestProfileInfo: context => {

                return new Promise((resolve, reject) => {
                    twitterApi.account(
                        'verify_credentials',
                        { 'include_email': true },
                        context.accessToken,
                        context.accessTokenSecret,
                        (error, data) => {
                            if (error) {
                                return reject(error);
                            }
                            resolve(data);
                        });
                });
            },

            requestAccessToken: context => {

                return new Promise((resolve, reject) => {
                    twitterApi.getAccessToken(
                        context.requestToken,
                        context.requestTokenSecret,
                        context.oauthVerifier,
                        (error, accessToken, accessTokenSecret, results) => {
                            if (error) {
                                return reject(error);
                            }
                            resolve({
                                accessToken: accessToken,
                                accessTokenSecret: accessTokenSecret
                            });
                        });
                });
            },

            validateAccessToken: context => {

                return new Promise((resolve, reject) => {
                    twitterApi.verifyCredentials(
                        context.accessToken,
                        context.accessTokenSecret,
                        (error, result) => {
                            if (error && error.statusCode === 401) {
                                let parsedError = JSON.parse(error.data);
                                let message = 'Invalid token';
                                if (Array.isArray(parsedError.errors) && parsedError.errors.length) {
                                    message = parsedError.errors[0].message;
                                }
                                return reject(new context.InvalidTokenError(message));
                            }
                            if (error) {
                                return reject(error);
                            }
                            if (result.id) {
                                return resolve();
                            }
                            return reject(new Error('Could not validate token, invalid response from twitter.'));
                        }
                    );
                });
            }
        };
    }
};
