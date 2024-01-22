'use strict';

module.exports = {

    rules: [
        {
            limit: 40000,                     // 40000 requests per day
            window: 1000 * 60 * 60 * 24,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 10,                       // 10 requests per second
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
