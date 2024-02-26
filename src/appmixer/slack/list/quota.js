'use strict';

module.exports = {

    rules: [
        {
            // https://api.slack.com/docs/rate-limits
            // Rate limits are currently unpublished except Message Posting
            // According to slack the limits for Post Messages are 1 request per 1 second period
            limit: 1,            // the quota is 1 per 1 second
            window: 1000,        // 1 second
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'postMessage',
            scope: 'userId'
        }
    ]
};
