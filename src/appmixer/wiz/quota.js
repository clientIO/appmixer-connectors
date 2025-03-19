'use strict';

module.exports = {

    rules: [
        {
            limit: 15000, // application is allowed to send 15000 queries per 24hrs
            window: 1000 * 60 * 60 * 24, // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        {
            limit: 25, // the quota is 25 per 20 seconds
            window: 1000 * 20, //20 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
