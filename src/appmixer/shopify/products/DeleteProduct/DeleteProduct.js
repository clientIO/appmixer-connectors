'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

/**
 * Delete a product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Product ID is required!');
        }

        await gqlProducts(lib.runner(context)).delete(id);
        return context.sendJson({}, 'out');
    }
};
