'use strict';
const commons = require('../../lib');

/**
 * Delete product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);
        const { id } = context.messages.in.content;


        if (!id) {
            throw new context.CancelError('ID is required!');
        }
        await shopify.product.delete(id);
        return context.sendJson({ id }, 'deleted');
    }
};
