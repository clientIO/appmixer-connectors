'use strict';

module.exports = {

    rules: [
        {
            limit: 2,                    // the quota is 2 per second
            window: 1000,               // 1 second
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
