'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when a fulfillment is created on a Shopify order.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'fulfillments/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'fulfillment');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const record = await commons.fetchLatestOrderChildExample(context, {
            child: 'fulfillment',
            topic: 'fulfillments/create'
        });
        if (!record) {
            throw new Error('No fulfillments to use as test data.');
        }
        return context.sendJson(record, 'fulfillment');
    }
};
