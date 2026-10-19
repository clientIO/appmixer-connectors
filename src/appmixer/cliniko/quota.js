'use strict';

module.exports = {
    rules: [
        {
            // Cliniko allows 200 requests per minute per user and answers a breach with
            // 429 + X-RateLimit-Reset. Stay just under it so polling triggers and
            // paginated Find components cannot starve the account's other integrations.
            limit: 180,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
