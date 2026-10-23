'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

/**
 * Get a product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Product ID is required!');
        }

        const product = await gqlProducts(lib.runner(context)).get(id);
        return context.sendJson(product, 'out');
    }
};
