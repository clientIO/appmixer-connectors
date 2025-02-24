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
            limit: 3,               // the quota is 2.5 per second, so let's try 3
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
        },
        {
            limit: 1000,            // user is allowed to modify 1000 messages a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'messages.modify'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.modify',
            scope: 'userId'
        },
        {
            limit: 500,             // user is allowed to list 500 messages a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'messages.list'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.list',
            scope: 'userId'
        },
        {
            limit: 500,             // user is allowed to create 500 drafts or labels a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'drafts.create'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'drafts.create',
            scope: 'userId'
        },
        {
            limit: 1000,            // user is allowed to read 1000 messages a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'messages.get'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.get',
            scope: 'userId'
        },
        {
            limit: 1000,            // user is allowed to move 1000 messages a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'messages.move'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'messages.move',
            scope: 'userId'
        },
        {
            limit: 500,             // user is allowed to list 500 labels a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'labels.list'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'labels.list',
            scope: 'userId'
        },
        {
            limit: 500,             // user is allowed to list 500 sendAs addresses (signatures) a day
            window: 1000 * 60 * 60 * 24,        // 24 hours
            scope: 'userId',
            resource: 'sendAs.list'
        },
        {
            limit: 5,               // the quota is 50 per second, so let's allow 5
            window: 1000,
            queueing: 'fifo',
            resource: 'sendAs.list',
            scope: 'userId'
        }
    ]
};
