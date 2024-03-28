'use strict';

// Note: Daily quotas refresh at midnight PST.
const getStartOfNextWindow = () => {

    return moment.utc().startOf('day').add(1, 'day').add(8, 'hours').valueOf();
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
            throttling: {
                type: 'window-fixed',
                getStartOfNextWindow: getStartOfNextWindow
            },
            resource: 'shares'
        }
    ]
};
