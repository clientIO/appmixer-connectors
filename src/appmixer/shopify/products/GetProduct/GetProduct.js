'use strict';
const commons = require('../../lib');

/**
 * Get a product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);
        const { id } = context.messages.in.content;


        if (!id) {
            throw new context.CancelError('ID is required!');
        }
        const product = await shopify.product.get(id);
        return context.sendJson(product, 'product');
    }
};
