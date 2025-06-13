'use strict';

module.exports = {

    rules: [
        {
            // 5 requests per second.
            limit: 5,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
