'use strict';

module.exports = {

    rules: [
        {
            limit: 100,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'loadFiles'
        },
        {
            limit: 5,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'loadFiles',
            scope: 'userId'
        }
    ]
};
