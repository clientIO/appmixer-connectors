'use strict';
const commons = require('../../shopify-commons');

/**
 * Get an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { id } = context.messages.in.content;

        const order = await shopify.order.get(id);
        return context.sendJson(order, 'order');
    }
};
