'use strict';

module.exports = {

    rules: [
        // https://dev.emarsys.com/docs/emarsys-core-api-guides/cd1025a4f6b0d-miscellaneous
        // The Core API allows 1000 requests per minute per API credential and answers 429 above
        // that. Stay a little under the documented cap so a burst of dropdown source calls does
        // not consume the customer's whole budget.
        {
            limit: 900,
            window: 1000 * 60,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
