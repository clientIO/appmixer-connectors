'use strict';

module.exports = {

    rules: [
        // http://developers.webflow.com/?javascript#rate-limits
        {
            limit: 60,                       // the quota is 60 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
