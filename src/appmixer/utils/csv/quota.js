'use strict';

module.exports = {

    rules: [
        {
            limit: 100,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'loadFiles'
        }
    ]
};
