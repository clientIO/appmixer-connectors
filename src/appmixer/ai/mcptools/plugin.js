'use strict';

module.exports = async context => {

    context.log('info', '[AI.MCPTOOLS] Initializing plugin.');

    // Keep a connection to Redis for publish/subscribe that we use to deliver
    // new chat messages to clients in real-time.
    if (!process.CONNECTOR_STREAM_PUB_CLIENT) {
        context.log('info', '[AI.MCPTOOLS] Connecting Redis Publisher client.');
        process.CONNECTOR_STREAM_PUB_CLIENT = await lib.connectRedis();
        context.log('info', '[AI.MCPTOOLS] Redis Publisher client connected.');
    }
    if (!process.CONNECTOR_STREAM_SUB_CLIENT) {
        context.log('info', '[AI.MCPTOOLS] Connecting Redis Subscriber client.');
        process.CONNECTOR_STREAM_SUB_CLIENT = await lib.connectRedis();
        context.log('info', '[AI.MCPTOOLS] Redis Subscriber client connected.');
    } else {
        // Make sure listeners are removed so that the ones registered in routes.js
        // will not introduce duplicate message handlers.
        // TODO: only listenrs that are registered by this plugin should be removed.
    }
    require('./routes')(context);
    context.log('info', '[AI.MCPTOOLS] plugin initialized.');
};
