'use strict';
const commons = require('../../lib');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/delete');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'deleted');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const deleted = await commons.fetchLatestDeleteExample(context, {
            resource: 'order',
            topic: 'orders/delete',
            params: { order: 'created_at DESC' }
        });
        if (!deleted) {
            throw new Error('No orders to use as test data.');
        }
        return context.sendJson(deleted, 'deleted');
    }
};

