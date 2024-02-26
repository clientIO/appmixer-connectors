'use strict';

function createRule(resource, authQuota) {

    return {
        name: resource,
        limit: authQuota,
        window: 15 * 60 * 1000,
        throttling: 'window-sliding',
        queueing: 'fifo',
        scope: 'userId',
        resource: resource
    };
}

module.exports = {

    rules: function() {

        // According to https://dev.twitter.com/rest/public/rate-limits
        let rules = [];

        rules.push(createRule('account/settings', 15));
        rules.push(createRule('account/verify_credentials', 15));
        rules.push(createRule('application/rate_limit_status', 180));
        rules.push(createRule('blocks/ids', 15));
        rules.push(createRule('blocks/list', 15));
        rules.push(createRule('direct_messages', 15));
        rules.push(createRule('direct_messages/sent', 15));
        rules.push(createRule('direct_messages/show', 15));
        rules.push(createRule('favorites/list', 15));
        rules.push(createRule('followers/ids', 15));
        rules.push(createRule('followers/list', 15));
        rules.push(createRule('friends/ids', 15));
        rules.push(createRule('friends/list', 15));
        rules.push(createRule('friendships/incoming', 15));
        rules.push(createRule('friendships/lookup', 15));
        rules.push(createRule('friendships/no_retweets/ids', 15));
        rules.push(createRule('friendships/outgoing', 15));
        rules.push(createRule('friendships/show', 180));
        rules.push(createRule('geo/id/:place_id', 15));
        rules.push(createRule('geo/reverse_geocode', 15));
        rules.push(createRule('geo/search', 15));
        rules.push(createRule('help/configuration', 15));
        rules.push(createRule('help/languages', 15));
        rules.push(createRule('help/privacy', 15));
        rules.push(createRule('help/tos', 15));
        rules.push(createRule('lists/list', 15));
        rules.push(createRule('lists/members', 180));
        rules.push(createRule('lists/members/show', 15));
        rules.push(createRule('lists/memberships', 15));
        rules.push(createRule('lists/ownerships', 15));
        rules.push(createRule('lists/show', 15));
        rules.push(createRule('lists/statuses', 180));
        rules.push(createRule('lists/subscribers', 180));
        rules.push(createRule('lists/subscribers/show', 15));
        rules.push(createRule('lists/subscriptions', 15));
        rules.push(createRule('mutes/users/ids', 15));
        rules.push(createRule('mutes/users/list', 15));
        rules.push(createRule('saved_searches/list', 15));
        rules.push(createRule('saved_searches/show/:id', 15));
        rules.push(createRule('search/tweets', 180));
        rules.push(createRule('statuses/lookup', 180));
        rules.push(createRule('statuses/mentions_timeline', 75));
        rules.push(createRule('statuses/home_timeline', 15));
        rules.push(createRule('statuses/oembed', 180));
        rules.push(createRule('statuses/retweeters/ids', 15));

        // statuses/retweets/:id shares quota with statuses/update
        //rules.push(createRule('statuses/retweets/:id', 15));
        rules.push({
            name: 'statuses/update',
            // if the customer needs more, that have to apply for premium twitter API
            limit: 300,                     // 300 per APP
            window: 1000 * 60 * 180,        // 3 hour window
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'statuses/update'
        });

        rules.push(createRule('statuses/retweets_of_me', 15));
        rules.push(createRule('statuses/show/:id', 180));
        rules.push(createRule('statuses/user_timeline', 180));
        rules.push(createRule('trends/available', 15));
        rules.push(createRule('trends/closest', 15));
        rules.push(createRule('trends/place', 15));
        rules.push(createRule('users/lookup', 180));
        rules.push(createRule('users/profile_banner', 180));
        rules.push(createRule('users/search', 180));
        rules.push(createRule('users/show', 180));
        rules.push(createRule('users/suggestions', 15));
        rules.push(createRule('users/suggestions/:slug', 15));
        rules.push(createRule('users/suggestions/:slug/members', 15));

        return rules;
    }
};
