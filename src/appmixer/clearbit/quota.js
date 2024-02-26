'use strict';

module.exports = {

    rules: [
        {
            // https://clearbit.com/docs#rate-limiting
            // According to Clearbit the limits are 600 requests per 1 minute
            limit: 600,                       // the quota is 600 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
