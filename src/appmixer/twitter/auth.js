'use strict';
const { requestAccessToken } = require('./twitter-commons');
module.exports = {

    type: 'oauth2',

    definition: {

        scope: ['tweet.read', 'users.read', 'offline.access'],

        accountNameFromProfileInfo: 'data.username',

        scopeDelimiter: ' ',
        authUrl: context => {

            return 'https://twitter.com/i/oauth2/authorize?' +
                'audience=api.atlassian.com&' +
                `client_id=${encodeURIComponent(context.clientId)}&` +
                `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                `state=${encodeURIComponent(context.ticket)}&` +
                `scope=${encodeURIComponent(context.scope.join(' '))}&` +
                'response_type=code&prompt=consent&' +
                `code_challenge=${context.ticket}&code_challenge_method=plain`;
        },

        requestAccessToken,
        requestProfileInfo: 'https://api.twitter.com/2/users/me'
    }
};
