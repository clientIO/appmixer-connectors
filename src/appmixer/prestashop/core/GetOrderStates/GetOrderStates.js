/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

// PrestaShop multilang fields are returned as an array of { id, value }. Take the first value.
function firstValue(field) {
    if (Array.isArray(field)) {
        return field.length ? field[0].value : '';
    }
    return field != null ? String(field) : '';
}

module.exports = {

    async receive(context) {

        const { orderId } = context.messages.in.content;

        if (!orderId) {
            throw new context.CancelError('Order ID is required!');
        }

        const orderData = await lib.psRequest(context, { path: `/orders/${orderId}` });
        const order = orderData.order;

        if (!order) {
            throw new context.CancelError(`Order ${orderId} not found.`);
        }

        // Build a map of state id -> readable name.
        const stateNames = {};
        try {
            const statesData = await lib.psRequest(context, {
                path: '/order_states',
                params: { display: 'full' }
            });
            for (const state of statesData.order_states || []) {
                stateNames[String(state.id)] = firstValue(state.name);
            }
        } catch (err) {
            await context.log({ step: 'Could not load order states', error: err.message });
        }

        const historyData = await lib.psRequest(context, {
            path: '/order_histories',
            params: {
                'filter[id_order]': orderId,
                display: 'full',
                sort: '[date_add_ASC]',
                date: 1
            }
        });

        const states = (historyData.order_histories || []).map(history => ({
            id: history.id,
            id_order_state: history.id_order_state,
            state_name: stateNames[String(history.id_order_state)] || '',
            date_add: history.date_add
        }));

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

        return context.sendJson({
            order_id: String(orderId),
            current_state: order.current_state,
            current_state_name: stateNames[String(order.current_state)] || '',
            customer,
            states
        }, 'out');
    }
};
