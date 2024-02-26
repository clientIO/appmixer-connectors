'use strict';

module.exports = {

    rules: [
        // https://developer.columbus.sage.com/docs#/us/sageone/accounts/gs-make-a-request
        // According to sageone the limits are 200 requests per 1 minute per sageone buisness
        {
            limit: 200,                       // the quota is 200 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
