'use strict';

module.exports = {

    rules: [
        {
            limit: 10000,            // 10,000 API requests in a 10 minute period
            window: 1000 * 60 * 10,
            scope: 'userId',
            resource: 'requests'
        },
        {
            limit: 4,               // 4 concurrent requests
            window: 1000,
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
