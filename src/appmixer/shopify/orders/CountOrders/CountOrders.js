'use strict';
const commons = require('../../lib');

/**
 * Count orders.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);
        const filter = context.messages.in.content;
        const count = await shopify.order.count(filter);
        return context.sendJson({ count }, 'out');
    }
};
