'use strict';

// Hugging Face throttles the Hub API in fixed 5 minute windows, per account:
// 1000 requests for a free user, 2500 for PRO, more for org plans. We hold every
// component to the free-tier bucket so the lowest plan never gets a 429, and add
// a per-second burst guard because Appmixer can fan a flow out wide.
// Inference Providers are billed from a credit allowance rather than a published
// per-minute request rate, so the same conservative rules cover them.
module.exports = {

    rules: [
        {
            limit: 1000,
            window: 300000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        },
        {
            limit: 5,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
