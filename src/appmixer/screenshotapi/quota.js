'use strict';

module.exports = {

    rules: [
        {
            // Free account is 100 screenshots per month.
            // https://screenshotapi.net/
            limit: 100,
            window: 1000 * 60 * 60 * 24 * 30,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
