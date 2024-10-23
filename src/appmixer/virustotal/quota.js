'use strict';

module.exports = {

    rules: [
        {
            limit: 4,                       // the quota is 4 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 500,                       // the quota is 500 per 1 day
            window: 1000 * 60 * 60 * 24,      // 1 day
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 15500,                       // the quota is 15.5k per month
            window: 1000 * 60 * 60 * 24 * 30,      // 30 days
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
