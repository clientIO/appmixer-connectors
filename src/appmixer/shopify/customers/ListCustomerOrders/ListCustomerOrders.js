'use strict';
const commons = require('../../lib');

/**
 * Delete customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);
        const { id } = context.messages.in.content;


        if (!id) {
            throw new context.CancelError('ID is required!');
        }
        const orders = await shopify.customer.orders(id);
        return context.sendJson(orders, 'orders');
    }
};
