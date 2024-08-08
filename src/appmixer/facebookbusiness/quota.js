'use strict';

module.exports = {

    rules: [
        // According to https://developers.facebook.com/docs/graph-api/advanced/rate-limiting app can make 200
        // calls per hour per user in aggregate
        {
            limit: 200,            // user is allowed to send 200 requests
            throttling: 'window-sliding',
            window: 1000 * 60 * 60,  // one hour
            queueing: 'fifo',
            scope: 'userId',
            resource: 'requests'
        }
    ]
};
