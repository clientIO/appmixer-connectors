'use strict';
const commons = require('../../lib');

/**
 * Delete customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context);

        const { id } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('ID is required!');
        }
        await shopify.customer.delete(id);
        return context.sendJson({ id }, 'deleted');
    }
};
