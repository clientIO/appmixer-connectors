'use strict';

module.exports = {

    rules: [
        {
            // Telegram publishes no fixed MTProto limits for user accounts; it answers bursts
            // with FLOOD_WAIT and repeated bursts can get the account restricted. Keep reads
            // well below the pace of a person scrolling through channels.
            limit: 30,
            window: 60 * 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
    ]
};
