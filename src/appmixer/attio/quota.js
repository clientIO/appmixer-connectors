'use strict';

// Attio allows 100 read and 25 write requests per second per workspace token, and
// answers 429 with Retry-After when exceeded. Stay safely under the write limit.
module.exports = {
    rules: [
        {
            limit: 20,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
