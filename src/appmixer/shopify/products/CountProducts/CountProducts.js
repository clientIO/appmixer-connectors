'use strict';
const lib = require('../../lib');
const gqlProducts = require('../../gql-products');

/**
 * Count the products matching a search query and typed filters.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const count = await gqlProducts(lib.runner(context)).count(context.messages.in.content);
        return context.sendJson({ count }, 'out');
    }
};
