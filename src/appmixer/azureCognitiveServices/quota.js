'use strict';

module.exports = {

    rules: [
        {
            // 20 requests per 1 minute
            limit: 20,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        {
            // 5000 requests per 1 month
            limit: 5000,
            window: 1000 * 60 * 60 * 24 * 30,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
