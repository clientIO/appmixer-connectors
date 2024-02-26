'use strict';
const commons = require('../../shopify-commons');

/**
 * Count products.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const filter = context.messages.in.content;
        const count = await shopify.product.count(filter);
        return context.sendJson({ count }, 'out');
    }
};
