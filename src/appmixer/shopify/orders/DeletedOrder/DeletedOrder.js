'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'orders/delete';

/**
 * Triggers when an order is deleted. Emits the ID of the deleted order.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return lib.registerWebhooks(context, [TOPIC]);
    },

    async stop(context) {

        return lib.unregisterWebhooks(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            return lib.receiveWebhook(context, { port: 'out', type: 'Order' });
        }
    },

    // A deleted order cannot be read any more; the sample is the ID of the
    // newest order, in the shape a deletion is reported in.
    async test(context) {

        const [order] = await gqlOrders(lib.runner(context)).pick({ max: 1 });
        if (!order) {
            throw new context.CancelError('There are no orders in the store yet. Create and delete an order to see sample data.');
        }
        return context.sendJson({ id: order.id, webhookTopic: TOPIC }, 'out');
    }
};
