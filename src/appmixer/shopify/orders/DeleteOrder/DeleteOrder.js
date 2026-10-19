'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

/**
 * Delete an order.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        if (!id) {
            throw new context.CancelError('Order ID is required!');
        }

        await gqlOrders(lib.runner(context)).delete(id);
        return context.sendJson({}, 'out');
    }
};
