'use strict';

module.exports = {

    rules: [
        {
            // write user quota limit on google
            limit: 60,
            window: 1000 * 60,
            scope: 'userId',
            queueing: 'fifo',
            resource: 'write'
        },
        {
            // slowing things down on the Appmixer site, because 60 parallel requests is a lot
            limit: 10,
            window: 1000,
            scope: 'userId',
            queueing: 'fifo',
            resource: 'write'
        },
        {
            // per project limit = 300 requests per minute
            limit: 300,
            window: 1000 * 60,
            queueing: 'fifo',
            resource: 'write'
        },
        {
            // read user quota limit on google
            limit: 60,
            window: 1000 * 60,
            scope: 'userId',
            queueing: 'fifo',
            resource: 'read'
        }
    ]
}
