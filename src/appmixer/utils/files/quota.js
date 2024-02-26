'use strict';

module.exports = {

    rules: [
        {
            limit: 80,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'storeFile'
        }
    ]
};
