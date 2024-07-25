'use strict';

module.exports = {

    rules: [
        {
            limit: 15,
            throttling: 'limit-concurrency',
            queueing: 'fifo',
            resource: 'loadFiles'
        }
    ]
};
