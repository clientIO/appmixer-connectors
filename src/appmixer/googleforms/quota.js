'use strict';

module.exports = {
    rules: [
        {
            // Google Forms API has a quota of 60 requests per minute per user
            limit: 60,
            window: 1000 * 60, // 1 minute
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'forms.api',
            scope: 'userId'
        },
        {
            // Daily quota limit
            limit: 5000,
            window: 1000 * 60 * 60 * 24, // 24 hours
            throttling: 'window-sliding',
            resource: 'forms.api',
            scope: 'userId'
        }
    ]
};