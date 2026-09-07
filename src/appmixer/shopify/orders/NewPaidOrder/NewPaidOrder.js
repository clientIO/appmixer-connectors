'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when an order is paid on Shopify.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'orders/paid');
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

        const record = await commons.fetchLatestWebhookExample(context, {
            resource: 'order',
            topic: 'orders/paid',
            params: { status: 'any', order: 'created_at DESC', financial_status: 'paid' }
        });
        if (!record) {
            throw new Error('No matching orders to use as test data.');
        }
        return context.sendJson(record, 'order');
    }
};
