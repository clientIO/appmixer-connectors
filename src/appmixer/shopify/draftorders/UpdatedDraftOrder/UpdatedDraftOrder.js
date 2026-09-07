'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when a draft order is updated on Shopify.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'draft_orders/update');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'draftOrder');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const record = await commons.fetchLatestWebhookExample(context, {
            resource: 'draftOrder',
            topic: 'draft_orders/update'
        });
        if (!record) {
            throw new Error('No draft orders to use as test data.');
        }
        return context.sendJson(record, 'draftOrder');
    }
};
