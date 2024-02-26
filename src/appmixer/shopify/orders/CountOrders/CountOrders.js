'use strict';
const commons = require('../../shopify-commons');

/**
 * Count orders.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const filter = context.messages.in.content;
        const count = await shopify.order.count(filter);
        return context.sendJson({ count }, 'out');
    }
};
