/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Order ID' },
    reference: { type: 'string', title: 'Reference' },
    id_customer: { type: 'string', title: 'Customer ID' },
    id_carrier: { type: 'string', title: 'Carrier ID' },
    current_state: { type: 'string', title: 'Current State ID' },
    payment: { type: 'string', title: 'Payment Method' },
    total_paid: { type: 'string', title: 'Total Paid' },
    total_paid_real: { type: 'string', title: 'Total Paid Real' },
    date_add: { type: 'string', title: 'Created Date' },
    date_upd: { type: 'string', title: 'Updated Date' }
};

module.exports = {

    async receive(context) {

        const { customerId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Orders' });
        }

        if (!customerId) {
            throw new context.CancelError('Customer ID is required!');
        }

        const data = await lib.psRequest(context, {
            path: '/orders',
            params: {
                'filter[id_customer]': customerId,
                display: 'full',
                sort: '[date_add_DESC]',
                date: 1,
                limit: 100
            }
        });

        const records = data.orders || [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
