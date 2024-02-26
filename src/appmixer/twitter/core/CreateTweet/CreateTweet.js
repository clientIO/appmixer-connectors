'use strict';
const { TwitterApi } = require('twitter-api-v2');

/**
 * Create Tweet component.
 */
module.exports = {

    async receive(context) {

        try {
            const { tweet } = context.messages.in.content;
            const client = new TwitterApi(context.auth.accessToken);
            const { data } = await client.v2.tweet(tweet.replace(/(?<!\w)(@)([\w]+)/g, '$2'));
            return context.sendJson(data, 'out');
        } catch (error) {
            throw error;
        }
        // FvJuev5kyKOWioAJq4ZWUgMW7-BVF9o5lTkGTI73hGIhoSuUHR
    }
};
