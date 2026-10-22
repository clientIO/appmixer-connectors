'use strict';
const lib = require('../../lib');
const gqlOrders = require('../../gql-orders');

const TOPIC = 'orders/updated';

// Shopify reports an update right after it creates an order; an order changed
// less than this long after it was created is not reported as updated.
const DEFAULT_UPDATE_THRESHOLD_MS = 2000;

function isUpdate(order, threshold) {

    return new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime() > threshold;
}

function updateThreshold(context) {

    const threshold = Number(context.config && context.config.updateThreshold);
    return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_UPDATE_THRESHOLD_MS;
}

/**
 * Triggers when an order is updated.
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
            const threshold = updateThreshold(context);
            return lib.receiveWebhook(context, {
                port: 'out',
                type: 'Order',
                fetch: async id => {
                    const order = await api.fetch(id);
                    return order && isUpdate(order, threshold) ? order : null;
                }
            });
        }
    },

    async test(context) {

        const api = gqlOrders(lib.runner(context));
        const orders = await api.find({ sortKey: 'UPDATED_AT', reverse: true, max: 10 });
        const threshold = updateThreshold(context);
        const order = orders.find(item => isUpdate(item, threshold));
        if (!order) {
            throw new context.CancelError('There are no updated orders in the store yet. Change an order to see sample data.');
        }
        return context.sendJson({ ...order, webhookTopic: TOPIC }, 'out');
    }
};
