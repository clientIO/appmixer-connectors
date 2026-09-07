'use strict';
const commons = require('../../lib');

/**
 * Component which triggers whenever new order comes.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'order');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const order = await commons.fetchLatestWebhookExample(context, {
            resource: 'order',
            topic: 'orders/create',
            params: { status: 'any', order: 'created_at DESC' }
        });
        if (!order) {
            throw new Error('No recent orders to use as test data.');
        }
        return context.sendJson(order, 'order');
    }
};

