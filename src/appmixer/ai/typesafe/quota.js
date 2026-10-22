'use strict';

// TypeSafe documents 40 requests/s (and 100K tokens/s) and says the limits are
// still "adjusting dynamically" while demand is high, so stay at half of that.
module.exports = {

    rules: [
        {
            limit: 20,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
