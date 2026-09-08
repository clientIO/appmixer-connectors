/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { orderId } = context.messages.in.content;

        if (!orderId) {
            throw new context.CancelError('Order ID is required!');
        }

        const data = await lib.psRequest(context, { path: `/orders/${orderId}` });
        const order = data.order;

        if (!order) {
            throw new context.CancelError(`Order ${orderId} not found.`);
        }

        // Associated customer.
        let customer = null;
        if (order.id_customer) {
            try {
                const customerData = await lib.psRequest(context, { path: `/customers/${order.id_customer}` });
                customer = customerData.customer || null;
            } catch (err) {
                await context.log({ step: 'Could not load customer', error: err.message });
            }
        }

        // State history (delivered, in progress, shipping updates, ...).
        let state_history = [];
        try {
            const historyData = await lib.psRequest(context, {
                path: '/order_histories',
                params: {
                    'filter[id_order]': orderId,
                    display: 'full',
                    sort: '[date_add_ASC]',
                    date: 1
                }
            });
            state_history = historyData.order_histories || [];
        } catch (err) {
            await context.log({ step: 'Could not load order history', error: err.message });
        }

        return context.sendJson({ ...order, customer, state_history }, 'out');
    }
};
