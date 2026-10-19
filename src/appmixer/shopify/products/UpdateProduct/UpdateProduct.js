'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

/**
 * Update a product. Empty fields keep their current values.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id, ...fields } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Product ID is required!');
        }

        const api = gqlProducts(lib.runner(context), {
            putFile: (url, data, headers) => context.httpRequest({ method: 'PUT', url, data, headers })
        });
        await api.update(id, fields);
        return context.sendJson({}, 'out');
    }
};
