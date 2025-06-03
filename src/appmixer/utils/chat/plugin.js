'use strict';

const lib = require('./lib');

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

    // Keep a connection to Redis for publish/subscribe that we use to deliver
    // new chat messages to clients in real-time.
    if (!process.PLUGIN_UTILS_CHAT_REDIS_PUB_CLIENT) {
        context.log('info', '[UTILS.CHAT] Connecting Redis Publisher client.');
        process.PLUGIN_UTILS_CHAT_REDIS_PUB_CLIENT = await lib.connectRedis();
        context.log('info', '[UTILS.CHAT] Redis Publisher client connected.');
    }
    if (!process.PLUGIN_UTILS_CHAT_REDIS_SUB_CLIENT) {
        context.log('info', '[UTILS.CHAT] Connecting Redis Subscriber client.');
        process.PLUGIN_UTILS_CHAT_REDIS_SUB_CLIENT = await lib.connectRedis();
        context.log('info', '[UTILS.CHAT] Redis Subscriber client connected.');
    } else {
        // Make sure listeners are removed so that the ones registered in routes.js
        // will not introduce duplicate message handlers.
        process.PLUGIN_UTILS_CHAT_REDIS_SUB_CLIENT.removeAllListeners();
    }

    require('./routes')(context);

    context.log('info', '[UTILS.CHAT] CHAT plugin initialized.');
};
