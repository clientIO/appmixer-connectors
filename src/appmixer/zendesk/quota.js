'use strict';

module.exports = {

    rules: [
        {
            limit: 200,                       // the quota is 200 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
