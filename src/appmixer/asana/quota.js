'use strict';

module.exports = {

    rules: [
        {
            // https://asana.com/developers/documentation/getting-started/errors
            // According to asana the limits are 100 requests per 1 minute per user
            limit: 100,                       // the quota is 100 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
