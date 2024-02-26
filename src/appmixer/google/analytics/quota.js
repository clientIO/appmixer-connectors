'use strict';

module.exports = {

    rules: [
        // https://developers.google.com/analytics/devguides/collection/ios/v3/limits-quotas
        {
            limit: 200000,  // user is allowed to send 200,000 hits per day
            throttling: 'window-sliding',
            window: 1000 * 60 * 60 * 24,  // 24 hours
            scope: 'userId',
            resource: 'requests'
        },
        {
            limit: 1,  // the avarage rate is 1 hit per second
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
