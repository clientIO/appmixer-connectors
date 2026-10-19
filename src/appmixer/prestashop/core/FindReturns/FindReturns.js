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

// PrestaShop does not expose merchandise returns (RMA records) through the Webservice API in
// any version (1.7, 8, 9). The return journey is therefore reconstructed from the order state
// history: a history entry belongs to the return journey when its order state uses the
// 'refund' email template or its name mentions a return/refund.
const RETURN_NAME_PATTERN = /return|refund|rembours|vr[aá][tc]|rma/i;

function isReturnState(state) {
    return firstValue(state.template) === 'refund' || RETURN_NAME_PATTERN.test(firstValue(state.name));
}

const schema = {
    id: { type: 'string', title: 'History Entry ID' },
    id_order: { type: 'string', title: 'Order ID' },
    id_customer: { type: 'string', title: 'Customer ID' },
    state: { type: 'string', title: 'State ID' },
    state_name: { type: 'string', title: 'State' },
    date_add: { type: 'string', title: 'Created Date' }
};

module.exports = {

    async receive(context) {

        const { orderId, customerId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Returns' });
        }

        // Resolve order states and keep only the return/refund related ones.
        const statesData = await lib.psRequest(context, {
            path: '/order_states',
            params: { display: 'full' }
        });
        const returnStates = {};
        for (const state of statesData.order_states || []) {
            if (isReturnState(state)) {
                returnStates[String(state.id)] = firstValue(state.name);
            }
        }

        // Collect the orders whose history should be inspected.
        let orders = [];
        if (orderId) {
            const orderData = await lib.psRequest(context, { path: `/orders/${orderId}` });
            if (orderData.order) {
                orders = [orderData.order];
            }
        } else {
            const params = {
                display: 'full',
                sort: '[date_add_DESC]',
                date: 1,
                limit: 100
            };
            if (customerId) {
                params['filter[id_customer]'] = customerId;
            }
            const data = await lib.psRequest(context, { path: '/orders', params });
            orders = data.orders || [];
        }

        const records = [];
        for (const order of orders) {
            const historyData = await lib.psRequest(context, {
                path: '/order_histories',
                params: {
                    'filter[id_order]': order.id,
                    display: 'full',
                    sort: '[date_add_ASC]',
                    date: 1
                }
            });
            for (const history of historyData.order_histories || []) {
                const stateName = returnStates[String(history.id_order_state)];
                if (stateName === undefined) {
                    continue;
                }
                records.push({
                    id: String(history.id),
                    id_order: String(order.id),
                    id_customer: String(order.id_customer),
                    state: String(history.id_order_state),
                    state_name: stateName,
                    date_add: history.date_add
                });
            }
        }

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
