'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

const TOPIC = 'products/update';

// Shopify sends products/update right after products/create too. An update
// within this many ms of the creation is taken as part of the create.
const DEFAULT_UPDATE_THRESHOLD_MS = 2000;

function isRealUpdate(context, product) {

    const threshold = Number(context.config.updateThreshold) || DEFAULT_UPDATE_THRESHOLD_MS;
    return Date.parse(product.updatedAt) - Date.parse(product.createdAt) > threshold;
}

/**
 * Triggers when a product is updated.
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
            return lib.receiveWebhook(context, {
                port: 'out',
                type: 'Product',
                fetch: async id => {
                    const product = await api.getOrNull(id);
                    return product && isRealUpdate(context, product) ? product : null;
                }
            });
        }
    },

    async test(context) {

        const products = await gqlProducts(lib.runner(context)).recent('UPDATED_AT', 10);
        const product = products.find(item => isRealUpdate(context, item));
        if (!product) {
            throw new context.CancelError('No product in the store was updated after it was created. Update a product to get sample data.');
        }
        return context.sendJson({ ...product, webhookTopic: TOPIC }, 'out');
    }
};
