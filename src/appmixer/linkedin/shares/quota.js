'use strict';

// Note: Daily quotas refresh at midnight PST (08:00 UTC). `moment` is provided by the quota loader.
const getStartOfNextWindow = () => {

    const next = moment.utc().startOf('day').add(8, 'hours');
    if (next.valueOf() <= Date.now()) {
        next.add(1, 'day');
    }
    return next.valueOf();
};

module.exports = {

    rules: [
        // https://developer.linkedin.com/docs/share-on-linkedin
        // According to LinkedIn the limits are 25 per day for one user
        {
            limit: 150,                     // the quota is 150 per 1 day
            window: 1000 * 60 * 60 * 24,          // 1 day
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'shares',
            scope: 'userId'
        },
        // https://developer.linkedin.com/docs/share-on-linkedin
        // According to LinkedIn the limits are 100000 per day for application
        {
            limit: 100000,
            // The quota server builds the fixed-window key from `window`; without it every
            // call fails with "Invalid time value". The TTL still comes from getStartOfNextWindow.
            window: 1000 * 60 * 60 * 24,
            throttling: {
                type: 'window-fixed',
                getStartOfNextWindow: getStartOfNextWindow
            },
            resource: 'shares'
        }
    ]
};
