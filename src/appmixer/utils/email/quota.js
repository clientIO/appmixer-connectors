'use strict';

module.exports = {

    rules: [
        // Our current Mandrill plan allows 25k/month emails. We will only allow 700 emails/day.
        {
            limit: 700,
            window: 1000 * 60 * 60 * 24,               // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
