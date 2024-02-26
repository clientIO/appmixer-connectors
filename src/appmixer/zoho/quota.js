'use strict';

module.exports = {

    rules: [
        // https://www.zoho.com/crm/developer/docs/api/v2/api-limits.html
        // According to zoho the limit is 5000 requests (credits) per day
        // per free account
        {
            limit: 5000,
            window: 1000 * 60 * 60 * 24,               // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
