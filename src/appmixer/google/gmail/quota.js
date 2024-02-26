'use strict';

module.exports = {

    rules: [
        {
            limit: 2000,            // user is allowed to send 2000 mails a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'messages.send'
        },
        {
            limit: 3,               // the quota is 2,5 per second, so let's try 3
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.send',
            scope: 'userId'
        },
        {
            /* the quota is 50 per second for messages.list/gets
               so, let's allow 1x list and 3x get - which is roughly 12 */
            limit: 12,
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.polling',
            scope: 'userId'
        }
    ]
};
