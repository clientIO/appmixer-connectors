'use strict';
const commons = require('../../lib');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/cancelled');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'cancelled');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const order = await commons.fetchLatestWebhookExample(context, {
            resource: 'order',
            topic: 'orders/cancelled',
            params: { status: 'cancelled', order: 'updated_at DESC' }
        });
        if (!order) {
            throw new Error('No recent cancelled orders to use as test data.');
        }
        return context.sendJson(order, 'cancelled');
    }
};

