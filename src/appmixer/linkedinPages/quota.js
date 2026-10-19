'use strict';

// Limits assume a Standard-tier Community Management app. A Development-tier app is capped
// by LinkedIn at 100 calls per member and 500 per app per day and gets 429 responses first.
// Fixed windows start at midnight UTC, which is also when LinkedIn resets its daily limits
// (https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits).
const DAY = 1000 * 60 * 60 * 24;

module.exports = {

    rules: [
        // Posting limit per member, rolling 24 hours.
        {
            limit: 150,
            window: DAY,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'shares',
            scope: 'userId'
        },
        // Application-wide safety limit for posts.
        {
            limit: 100000,
            window: DAY,
            throttling: 'window-fixed',
            resource: 'shares'
        },
        // Application-wide safety limit for other API calls (MakeApiCall).
        {
            limit: 100000,
            window: DAY,
            throttling: 'window-fixed',
            resource: 'requests'
        }
    ]
};
