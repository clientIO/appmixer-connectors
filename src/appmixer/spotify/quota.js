'use strict';

module.exports = {
    rules: [
        {
            // Spotify does not publish a number: the limit is computed from a rolling
            // 30-second window and scales with the app, and a Development Mode app
            // (max 5 authorized users) sits at the bottom of that scale. Throttling to
            // a conservative shared budget keeps a 40-track FindTracks fan-out from
            // burning through the window; `lib.apiRequest` still honours the
            // `Retry-After` header on the 429s that slip through.
            limit: 60,
            window: 1000 * 30,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
