'use strict';
const OAuth = require('oauth').OAuth;
const Promise = require('bluebird');

module.exports = {

    type: 'oauth',

    definition: context => {

        let trelloOauth = Promise.promisifyAll(new OAuth(
            'https://trello.com/1/OAuthGetRequestToken',
            'https://trello.com/1/OAuthGetAccessToken',
            context.consumerKey,
            context.consumerSecret,
            '1.0',
            context.callbackUrl,
            'HMAC-SHA1'
        ), { multiArgs: true });

        return {

            accountNameFromProfileInfo: 'id',

            authUrl: context => {

                return 'https://trello.com/1/OAuthAuthorizeToken' +
                    '?oauth_token=' + context.requestToken +
                    `&name=${context.config.name || 'Appmixer'}` +
                    '&scope=read,write,account' +
                    '&expiration=never';
            },

            requestRequestToken: () => {

                return trelloOauth.getOAuthRequestTokenAsync()
                    .then(result => {
                        return {
                            requestToken: result[0],
                            requestTokenSecret: result[1]
                        };
                    });
            },

            requestAccessToken: context => {

                return trelloOauth.getOAuthAccessTokenAsync(
                    context.requestToken,
                    context.requestTokenSecret,
                    context.oauthVerifier
                ).then(result => {
                    return {
                        accessToken: result[0],
                        accessTokenSecret: result[1]
                    };
                });
            },

            requestProfileInfo: context => {

                return trelloOauth.getProtectedResourceAsync(
                    'https://api.trello.com/1/members/me',
                    'GET',
                    context.accessToken,
                    context.accessTokenSecret
                ).then(result => {
                    if (result[1].statusCode !== 200) {
                        throw new Error(result[1].statusMessage);
                    }
                    result = JSON.parse(result[0]);
                    // get rid of limits for now
                    // may and will contain keys with dots - mongo doesn't like it
                    delete result.limits;
                    return result;
                });
            },

            validateAccessToken: context => {

                return trelloOauth.getProtectedResourceAsync(
                    'https://api.trello.com/1/tokens/' + context.accessToken,
                    'GET',
                    context.accessToken,
                    context.accessTokenSecret
                ).then(result => {
                    if (result[1].statusCode === 401) {
                        throw new context.InvalidTokenError(result[1].statusMessage);
                    }
                    if (result[1].statusCode !== 200) {
                        throw new Error(result[1].statusMessage);
                    }

                    result = JSON.parse(result[0]);
                    if (result['dateExpires'] === null) {
                        return;
                    }
                    throw new context.InvalidTokenError('Invalid token.');
                });
            }
        };
    }
};
