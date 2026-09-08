'use strict';

module.exports = {

    rules: [
        {
            limit: 500,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
