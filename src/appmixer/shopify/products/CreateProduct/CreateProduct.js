'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

/**
 * Create a product.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const fields = context.messages.in.content;
        if (!fields.title) {
            throw new context.CancelError('Title is required!');
        }

        const api = gqlProducts(lib.runner(context), {
            putFile: (url, data, headers) => context.httpRequest({ method: 'PUT', url, data, headers })
        });
        const product = await api.create(fields);
        return context.sendJson(product, 'out');
    }
};
