'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

const TOPIC = 'products/delete';

/**
 * Triggers when a product is deleted. Emits the id of the deleted product.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, [TOPIC]);
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            return lib.receiveWebhook(context, { port: 'out', type: 'Product' });
        }
    },

    // A deleted product cannot be read back; the newest product's id stands
    // in for it, in the shape the trigger emits.
    async test(context) {

        const [product] = await gqlProducts(lib.runner(context)).recent('CREATED_AT');
        if (!product) {
            throw new context.CancelError('The store has no products yet. Create and delete a product to get sample data.');
        }
        return context.sendJson({ id: product.id, webhookTopic: TOPIC }, 'out');
    }
};
