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

        let rules = [];

        rules.push(createRule('core/create_tweet', 200));
        rules.push(createRule('core/delete_tweet', 50));

        return rules;
    }
};
