'use strict';
const { TwitterApi } = require('twitter-api-v2');

/**
 * Create Tweet component.
 */
module.exports = {

    async receive(context) {

        try {
            const { tweetId } = context.messages.in.content;
            const client = new TwitterApi(context.auth.accessToken);
            const { data } = await client.v2.deleteTweet(tweetId);
            return context.sendJson(data, 'out');
        } catch (error) {
            throw error;
        }

    }
};
