'use strict';
const commons = require('../../shopify-commons');

/**
 * Count customers.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const count = await shopify.customer.count();
        return context.sendJson({ count }, 'out');
    }
};
