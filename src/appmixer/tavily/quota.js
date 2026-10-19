'use strict';

// Tavily's documented ceiling is 100 requests/minute on development keys and
// 1000 requests/minute on production keys. We throttle to the lower of the two
// and queue the overflow so flows degrade gracefully instead of hitting 429s.
module.exports = {

    rules: [
        {
            limit: 100,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
