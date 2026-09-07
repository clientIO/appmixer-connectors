'use strict';
const commons = require('../../lib');

/**
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/fulfilled');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'fulfilled');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const order = await commons.fetchLatestWebhookExample(context, {
            resource: 'order',
            topic: 'orders/fulfilled',
            // 'shipped' selects fully fulfilled orders in the Shopify REST Admin API.
            params: { status: 'any', fulfillment_status: 'shipped', order: 'updated_at DESC' }
        });
        if (!order) {
            throw new Error('No recent fulfilled orders to use as test data.');
        }
        return context.sendJson(order, 'fulfilled');
    }
};

