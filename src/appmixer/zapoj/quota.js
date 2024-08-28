'use strict';

module.exports = {

    rules: [
        {
            limit: 1, // Approximately 1 request per second
            window: 1000,
            queueing: 'fifo',
            resource: 'request',
            scope: 'userId'
        }
    ]
};
