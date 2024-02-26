'use strict';
const EvernoteAPI = require('evernote');
const commons = require('./evernote-commons');

// when developing evernote components don't forget to change it in
// components/lib/evernote/../../evernote-commons as well
const sandbox = process.env['EVERNOTE_SANDBOX'] || false;

module.exports = {

    type: 'oauth',

    definition: context => {

        let evernote = new EvernoteAPI.Client({
            consumerKey: context.consumerKey,
            consumerSecret: context.consumerSecret,
            sandbox: sandbox
        });

        return {

            accountNameFromProfileInfo: context => {

                return context.profileInfo['username'] || context.profileInfo['id'].toString();
            },

            requestRequestToken: () => {
                return new Promise((resolve, reject) => {
                    evernote.getRequestToken(
                        context.callbackUrl,
                        (err, oauthToken, oauthTokenSecret) => {
                            if (err) {
                                return reject(commons.verboseError(err));
                            }
                            resolve({
                                requestToken: oauthToken,
                                requestTokenSecret: oauthTokenSecret
                            });
                        }
                    );
                });
            },

            authUrl: context => {

                return evernote.getAuthorizeUrl(context.requestToken);
            },

            requestProfileInfo: context => {

                let client = new EvernoteAPI.Client({
                    token: context.accessToken,
                    sandbox: sandbox
                });
                let userStore = client.getUserStore();
                return userStore.getUser();
            },

            requestAccessToken: context => {

                return new Promise((resolve, reject) => {
                    return evernote.getAccessToken(
                        context.requestToken,
                        context.requestTokenSecret,
                        context.oauthVerifier,
                        (err, accessToken) => {
                            if (err) {
                                return reject(commons.verboseError(err));
                            }
                            resolve({
                                accessToken: accessToken,
                                // Evernote always returns empty string in accessTokenSecret
                                accessTokenSecret: 'TokensTokens'
                            });
                        });
                });
            },

            validateAccessToken: context => {

                let client = new EvernoteAPI.Client({
                    token: context.accessToken,
                    sandbox: sandbox
                });
                let userStore = client.getUserStore();
                return userStore.getUser()
                    .catch(err => {
                        if (err && err.errorCode === 9) {
                            throw new context.InvalidTokenError('Invalid token');
                        }
                        throw commons.verboseError(err);
                    });
            }
        };
    }
};
