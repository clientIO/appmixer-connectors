'use strict';

module.exports = {

    rules: [
        {
            limit: 1000000, // application is allowed to send 1 000 000 queries per 24hrs
            window: 1000 * 60 * 60 * 24, // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        {
            limit: 2500, // the quota is 2 500 per 20 seconds
            window: 1000 * 20, // 20 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
