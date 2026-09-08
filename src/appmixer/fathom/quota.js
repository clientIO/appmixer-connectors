'use strict';

// Fathom rate limits (per user, across all of that user's API keys / tokens):
//   - Global:  60 requests / 60 s
//   - "Heavy": 30 requests / 60 s (throttled to as low as 5/60 s under high platform load).
//     Heavy endpoints include GET /recordings/{id}/summary and /transcript.
// See https://developers.fathom.ai/api-overview
module.exports = {
    rules: [
        {
            limit: 60,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 30,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'heavy',
            scope: 'userId'
        }
    ]
};
