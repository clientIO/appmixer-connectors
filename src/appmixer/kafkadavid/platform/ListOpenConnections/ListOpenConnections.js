'use strict';

const connections = require('../../connections');

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
            return context.response({});
        }

        const out = {
            openConnections: Object.keys(connections.listConnections()),
            registeredConnections: await context.service.loadState()
        };

        return context.sendJson(out, 'out');
    }
};
