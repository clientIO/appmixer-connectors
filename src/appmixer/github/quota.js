'use strict';

module.exports = {

    rules: [
        {
            limit: 5000,                     // the quota is 5000 per 1 hour
            window: 1000 * 60 * 60,          // 1 hour
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 30,                       // the quota is 30 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'search',
            scope: 'userId'
        }
    ]
};
