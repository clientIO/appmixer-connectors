'use strict';
const commons = require('../../shopify-commons');

/**
 * Delete customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { id } = context.messages.in.content;

        const orders = await shopify.customer.orders(id);
        return context.sendJson(orders, 'orders');
    }
};
