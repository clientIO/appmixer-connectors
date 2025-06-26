'use strict';

module.exports = {

    rules: [
        {
            limit: 100,
            window: 1000 * 60, // 1 minute
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'forms.api',
            scope: 'userId'
        },
        {
            limit: 10000,
            window: 1000 * 60 * 60 * 24, // 24 hours
            throttling: 'window-sliding',
            resource: 'forms.api',
            scope: 'userId'
        }
    ]
};
