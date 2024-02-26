'use strict';

module.exports = {

    rules: [
        {
            // https://github.com/basecamp/highrise-api
            // According to highrise the limits are 500 requests per 10 second period
            // from the same IP address for the same account
            limit: 500,               // the quota is 500 per 10 seconds
            window: 1000 * 10,        // 10 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 2,                 // the quota is 2 per 10 seconds
            window: 1000 * 10,        // 10 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'searchContacts',
            scope: 'userId'
        }
    ]
};
