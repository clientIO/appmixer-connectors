'use strict';

module.exports = async context => {

    context.log('info', '[UTILS.CHAT] Initializing CHAT plugin.');
    // The plugin will be loaded on all nodes in the cluster. Only one node can perform this init.
    const lock = await context.lock('utils-chat-init');
    try {
        await require('./ChatMessageModel')(context).createIndex({ chatId: 1, userId: 1 });
        await require('./ChatSessionModel')(context).createIndex({ id: 1 });
    } finally {
        lock.unlock();
    }
    require('./routes')(context);
    context.log('info', '[UTILS.CHAT] CHAT plugin initialized.');
};
