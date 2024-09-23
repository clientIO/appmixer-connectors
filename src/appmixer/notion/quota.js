'use strict';

module.exports = {

    rules: [
        {
            limit: 2,
            window: 1000,
            queueing: 'fifo',
            resource: 'general',
            scope: 'userId'
        }
    ]
};
