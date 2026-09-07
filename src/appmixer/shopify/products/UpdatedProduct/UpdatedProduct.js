'use strict';
const commons = require('../../lib');

/**
 * Component which triggers whenever new product comes.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return commons.registerWebhook(context, 'products/update');
    },

    async receive(context) {

        if (context.messages.webhook) {
            return commons.onReceive(context, 'product');
        }
    },

    async stop(context) {

        return commons.unregisterWebhook(context);
    },

    async test(context) {

        const product = await commons.fetchLatestWebhookExample(context, {
            resource: 'product',
            topic: 'products/update',
            params: { order: 'updated_at DESC' }
        });
        if (!product) {
            throw new Error('No recent products to use as test data.');
        }
        return context.sendJson(product, 'product');
    }
};
