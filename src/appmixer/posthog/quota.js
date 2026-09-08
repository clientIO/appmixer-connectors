'use strict';

module.exports = {
    rules: [
        // PostHog personal API key rate limit: 240 requests/minute.
        {
            limit: 240,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        // PostHog query endpoint rate limit: 120 requests/hour.
        {
            limit: 120,
            window: 1000 * 60 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'query',
            scope: 'userId'
        }
    ]
};
