'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'orders/cancelled';

/**
 * Triggers when an order is cancelled.
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
            const api = gqlOrders(lib.runner(context));
            return lib.receiveWebhook(context, { port: 'out', type: 'Order', fetch: id => api.fetch(id) });
        }
    },

    async test(context) {

        const api = gqlOrders(lib.runner(context));
        const [order] = await api.find({ query: 'status:cancelled', sortKey: 'UPDATED_AT', reverse: true, max: 1 });
        if (!order) {
            throw new context.CancelError('There are no cancelled orders in the store yet. Cancel an order to see sample data.');
        }
        return context.sendJson({ ...order, webhookTopic: TOPIC }, 'out');
    }
};
