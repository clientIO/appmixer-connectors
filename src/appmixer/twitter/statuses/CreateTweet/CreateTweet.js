'use strict';
const commons = require('../../twitter-commons');

/**
 * Create Tweet component.
 */
module.exports = {

    receive(context) {

        const status = context.messages.in.content;

        return commons.getTwitterApi(context.auth).statusesAsync(
            'update',
            // Twitter has strict rules when it comes to automated @mentions
            // https://help.twitter.com/en/rules-and-policies/twitter-automation
            // Basically we have to remove all the mentions in tweets. Otherwise any user would be able to
            // setup a flow that would send tweets with mentions and soon Twitter would block the whole
            // Appmixer app, blocking CreateTweet component for all users in the system.
            // Other approach would be to somehow detect multiple mentions (spamming according to Twitter rules)
            // and block only those. But that's uneasy challenge. Since rules for that are not public and
            // Twitter may change them at any time.
            { status: status.tweet.replace(/(?<!\w)(@)([\w]+)/g, '$2') },
            context.auth.accessToken,
            context.auth.accessTokenSecret
        ).then(response => {
            return context.sendJson(response, 'tweet');
        }).catch(err => {
            if (err.statusCode === 403) {  // forbidden
                throw new context.CancelError(JSON.stringify(JSON.parse(err.data).errors));
            }
            throw err;
        });
    }
};
