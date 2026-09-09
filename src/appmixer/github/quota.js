'use strict';

module.exports = {

    rules: [
        {
            limit: 5,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests'
        },
        {
            // GraphQL (Projects v2). GitHub allows 5000 points/hour; the previous
            // 5/min was exhausted by the designer's schema calls alone.
            limit: 60,
            window: 60000,
            queueing: 'fifo',
            resource: 'requests-projects'
        }
    ]
};
