'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'orders/paid';

/**
 * Triggers when an order is paid.
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
        const [order] = await api.find({ query: 'financial_status:paid', sortKey: 'UPDATED_AT', reverse: true, max: 1 });
        if (!order) {
            throw new context.CancelError('There are no paid orders in the store yet. Mark an order as paid to see sample data.');
        }
        return context.sendJson({ ...order, webhookTopic: TOPIC }, 'out');
    }
};
