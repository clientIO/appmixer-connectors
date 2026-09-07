'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when a refund is created on a Shopify order.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'refunds/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'refund');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const record = await commons.fetchLatestOrderChildExample(context, {
            child: 'refund',
            topic: 'refunds/create'
        });
        if (!record) {
            throw new Error('No refunds to use as test data.');
        }
        return context.sendJson(record, 'refund');
    }
};
