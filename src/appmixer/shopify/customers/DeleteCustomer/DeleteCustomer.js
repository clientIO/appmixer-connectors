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
        await shopify.customer.delete(id);
        return context.sendJson({ id }, 'deleted');
    }
};
