'use strict';

module.exports = {

    rules: [
        {
            limit: 1,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
