'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

/**
 * Count the orders matching a search query and filters.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let query;
        try {
            query = gqlOrders.searchQuery(context.messages.in.content);
        } catch (err) {
            throw new context.CancelError(err.message);
        }

        const count = await gqlOrders(lib.runner(context)).count(query);
        return context.sendJson({ count }, 'out');
    }
};
