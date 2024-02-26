'use strict';
const commons = require('../../shopify-commons');

/**
 * Get a customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { id } = context.messages.in.content;

        const customer = await shopify.customer.get(id);
        return context.sendJson(customer, 'customer');
    }
};
