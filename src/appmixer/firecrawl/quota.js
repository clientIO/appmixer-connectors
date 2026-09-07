'use strict';

// Firecrawl rate limits depend on the plan (scrape/map/search: 10 rpm Free up
// to 10000 rpm Scale; crawl/extract: 2 rpm Free up to 2000 rpm Scale). We
// throttle to the Hobby tier and queue overflow so flows on any plan degrade
// gracefully instead of hitting 429 errors.
module.exports = {

    rules: [
        {
            // scrape, search, map and status/read calls.
            limit: 100,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            // crawl and extract job submissions.
            limit: 20,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'jobs',
            scope: 'userId'
        }
    ]
};
