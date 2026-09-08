'use strict';

// Bright Data does not publish a single hard rate limit — the practical ceiling
// depends on the zone and plan, and the account-management endpoints are the
// tightest. We throttle every component to a conservative shared budget and
// queue the overflow so flows degrade gracefully instead of hitting 429s.
module.exports = {

    rules: [
        {
            limit: 10,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
