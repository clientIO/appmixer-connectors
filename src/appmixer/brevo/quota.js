'use strict';

module.exports = {

    rules: [
        {
            limit: 5,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
