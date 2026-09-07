'use strict';
const commons = require('../../lib');

/**
 * Count customers.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);

        const count = await shopify.customer.count();
        return context.sendJson({ count }, 'out');
    }
};
