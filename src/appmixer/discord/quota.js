'use strict';

module.exports = {

    rules: [
        {
            limit: 50,
            window: 1000,
            queueing: 'fifo',
            resource: 'requests'
        }
    ]
};
