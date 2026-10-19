'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'refunds/create';

/**
 * Triggers when a refund is created on an order.
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
            return lib.receiveWebhook(context, { port: 'out', type: 'Refund', fetch: id => api.fetchRefund(id) });
        }
    },

    async test(context) {

        const refund = await gqlOrders(lib.runner(context)).latestRefund();
        if (!refund) {
            throw new context.CancelError('There are no refunds on the recently updated orders. Refund an order to see sample data.');
        }
        return context.sendJson({ ...refund, webhookTopic: TOPIC }, 'out');
    }
};
