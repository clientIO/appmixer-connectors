'use strict';

// fal.ai publishes no official rate limits. This is a conservative default
// scoped per Appmixer user to avoid overwhelming a single account/team key.
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
