'use strict';

module.exports = {

    rules: [
        // According to ActiveCampaign the limit is 5 requests per second
        {
            limit: 5, // the quota is 5 per second
            window: 1000, //1 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        },
        {
            limit: 2.5, // the quota is 5 per second
            window: 1000, //1 sec
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'update-deal'
        }
    ]
};
