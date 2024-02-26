'use strict';

module.exports = {

    rules: [
        // According to google, this daily limit does not depend on any time-zone related
        // window, it's supposed to be sliding window 24h
        {
            limit: 1000000,            // user is allowed to send 1000000 queries a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'requests'
        },
        {
            limit: 5,               // the quota is 500 per 100 seconds
            window: 1000,
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
