'use strict';

module.exports = {

    rules: [
        // https://home.openweathermap.org/subscriptions
        // Free plan: 60/minute.
        {
            limit: 60,                       // the quota is 60 per 60 seconds
            window: 1000 * 60,               // 60 seconds
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
