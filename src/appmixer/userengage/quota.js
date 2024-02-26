'use strict';

module.exports = {

    rules: [
        // https://userengage.io/en/api/basic-usage/
        // According to userengage the limits are 500 requests per 1 minute per user
        {
            limit: 500,                       // the quota is 500 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
