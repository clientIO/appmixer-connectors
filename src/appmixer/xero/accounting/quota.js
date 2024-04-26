'use strict';

module.exports = {

    rules: [
        // https://developer.xero.com/documentation/guides/oauth2/limits/
        // According to Xero the limit is 5000 requests per day
        {
            limit: 5000,
            window: 1000 * 60 * 60 * 24,               // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 60,
            window: 1000 * 60,               // 1 minute
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
