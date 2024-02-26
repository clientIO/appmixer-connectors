'use strict';

// Note: Daily quotas refresh at midnight PST.
let getStartOfNextWindow = function() {

    return moment.utc().startOf('day').add(1, 'day').add(8, 'hours').valueOf();
};

module.exports = {

    rules: [
        // https://developer.linkedin.com/docs/share-on-linkedin
        // According to LinkedIn the limits are 25 per day for one user
        {
            limit: 25,                     // the quota is 25 per 1 day
            window: 1000 * 60 * 60 * 24,          // 1 day
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'shares',
            scope: 'userId'
        },
        // https://developer.linkedin.com/docs/share-on-linkedin
        // According to LinkedIn the limits are 125000 per day for application
        {
            limit: 125000,
            throttling: {
                type: 'window-fixed',
                getStartOfNextWindow: getStartOfNextWindow
            },
            resource: 'shares'
        }
    ]
};
