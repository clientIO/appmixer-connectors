'use strict';

module.exports = {

    rules: [
        // https://www.zoho.com/books/api/v3/introduction/#api-call-limit
        // According to zoho the limit is 1000 requests per day
        // per free account
        {
            limit: 1000,
            window: 1000 * 60 * 60 * 24,               // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
