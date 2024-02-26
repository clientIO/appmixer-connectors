'use strict';

module.exports = {

    rules: [
        // According to Blackboard the limit is 10k requests every 24 hours
        {
            limit: 10000, // the quota is 10k per 24 hours
            window: 24 * 60 * 60 * 1000, //24 hours
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
