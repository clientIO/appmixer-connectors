'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

const TOPIC = 'products/create';

/**
 * Triggers when a product is created.
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
            const api = gqlProducts(lib.runner(context));
            return lib.receiveWebhook(context, { port: 'out', type: 'Product', fetch: id => api.getOrNull(id) });
        }
    },

    async test(context) {

        const [product] = await gqlProducts(lib.runner(context)).recent('CREATED_AT');
        if (!product) {
            throw new context.CancelError('The store has no products yet. Create a product to get sample data.');
        }
        return context.sendJson({ ...product, webhookTopic: TOPIC }, 'out');
    }
};
