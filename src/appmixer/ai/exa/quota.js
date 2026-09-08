'use strict';

// Exa's documented defaults are 10 QPS on /search and /answer and 100 QPS on
// /contents. We throttle every component to the lowest of those and queue the
// overflow so flows degrade gracefully instead of hitting 429s.
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
