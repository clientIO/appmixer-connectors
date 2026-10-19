'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'fulfillments/create';

/**
 * Triggers when a fulfillment is created on an order.
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
            return lib.receiveWebhook(context, { port: 'out', type: 'Fulfillment', fetch: id => api.fetchFulfillment(id) });
        }
    },

    async test(context) {

        const fulfillment = await gqlOrders(lib.runner(context)).latestFulfillment('createdAt');
        if (!fulfillment) {
            throw new context.CancelError('There are no fulfillments on the recently updated orders. Fulfill an order to see sample data.');
        }
        return context.sendJson({ ...fulfillment, webhookTopic: TOPIC }, 'out');
    }
};
