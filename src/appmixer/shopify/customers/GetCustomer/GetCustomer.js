'use strict';
const commons = require('../../lib');

/**
 * Get a customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);
        const { id } = context.messages.in.content;


        if (!id) {
            throw new context.CancelError('ID is required!');
        }
        const customer = await shopify.customer.get(id);
        return context.sendJson(customer, 'customer');
    }
};
