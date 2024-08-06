'use strict';

module.exports = {

    rules: [
        // http://help.trello.com/article/838-api-rate-limits
        // According to trello the limits are 300 requests per 10 second period for each API key
        // and 100 requests per 10 seconds for each token
        {
            limit: 100,                     // the quota is 100 per 10 seconds
            window: 1000 * 10,              // 10 seconds
            queueing: 'fifo',
            throttling: 'window-sliding',
            resource: 'requests',
            scope: 'userId'
        },

        // Special case: CreateCard with possible 11 additional requests for checklist
        // 1 request for CreateCard
        // 1 request for adding checklist to the card
        // 10 requests for adding items to the checklist
        {
            limit: 8, // 100 / 12 ~= 8 with some room for the `requests` quota category
            window: 1000 * 10,
            queueing: 'fifo',
            throttling: 'window-sliding',
            resource: 'CreateCard',
            scope: 'userId'
        },

        // Special case: AddChecklistToCard with possible 10 additional requests for checklist
        // 1 request for AddChecklistToCard
        // 10 requests for adding items to the checklist
        {
            limit: 9, // 100 / 11 ~= 9
            window: 1000 * 10,
            queueing: 'fifo',
            throttling: 'window-sliding',
            resource: 'AddChecklistToCard',
            scope: 'userId'
        }
    ]
};
