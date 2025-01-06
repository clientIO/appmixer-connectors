'use strict';

module.exports = {

    rules: [
        // CloudFlare quota is 1200 per 5 minutes
        {
            limit: 80, // components call multiple api call - add/remove + get status + (optional: get id)
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
