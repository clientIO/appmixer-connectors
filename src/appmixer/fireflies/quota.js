'use strict';

// Fireflies rate limits are plan dependent: Free 50 req/day, Pro 500 req/day,
// Business/Enterprise 60 req/min. We throttle to the most permissive
// per-minute ceiling (Business) and queue overflow so flows degrade
// gracefully instead of hitting `too_many_requests`.
module.exports = {

    rules: [
        {
            limit: 55,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
