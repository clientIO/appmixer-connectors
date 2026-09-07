'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when a fulfillment is updated on a Shopify order (e.g. tracking / shipment status changes).
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'fulfillments/update');
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
            topic: 'fulfillments/update'
        });
        if (!record) {
            throw new Error('No fulfillments to use as test data.');
        }
        return context.sendJson(record, 'fulfillment');
    }
};
