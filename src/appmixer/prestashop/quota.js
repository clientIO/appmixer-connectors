'use strict';

module.exports = {

    rules: [
        {
            limit: 5,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
