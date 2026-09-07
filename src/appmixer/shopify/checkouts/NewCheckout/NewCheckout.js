'use strict';
const commons = require('../../lib');

/**
 * This trigger fires when a checkout is created on Shopify.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'checkouts/create');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'checkout');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const record = await commons.fetchLatestWebhookExample(context, {
            resource: 'checkout',
            topic: 'checkouts/create'
        });
        if (!record) {
            throw new Error('No checkouts to use as test data.');
        }
        return context.sendJson(record, 'checkout');
    }
};
