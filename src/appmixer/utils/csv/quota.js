'use strict';

module.exports = {

    rules: [
        {
            limit: 5,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'loadFiles'
        }
    ]
};
