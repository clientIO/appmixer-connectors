'use strict';

module.exports = {

    // https://cloud.google.com/translate/pricing
    rules: [
        // TODO: This needs to be changed. The pricing is per translated character, not the number of requests.
        {
            limit: 10000,
            window: 1000 * 60 * 60 * 24,               // 24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
