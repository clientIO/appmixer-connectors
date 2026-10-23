'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

/**
 * Get an order by its ID.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Order ID is required!');
        }

        const order = await gqlOrders(lib.runner(context)).get(id);
        return context.sendJson(order, 'out');
    }
};
