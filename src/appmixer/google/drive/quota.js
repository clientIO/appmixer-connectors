'use strict';

module.exports = {

    rules: [
        {
            // user quota limit on google
            //https://developers.google.com/drive/api/guides/limits
            limit: 12000,
            window: 1000 * 60,
            scope: 'userId',
            queueing: 'fifo',
            resource: 'readandwrite'
        },
        {
            // application quota limit
            limit: 12000,
            window: 1000 * 60,
            queueing: 'fifo',
            resource: 'readandwrite'
        }
    ]
};
