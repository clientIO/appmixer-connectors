/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Product ID' },
    reference: { type: 'string', title: 'Reference' },
    price: { type: 'string', title: 'Price' },
    active: { type: 'string', title: 'Active' },
    id_category_default: { type: 'string', title: 'Default Category ID' },
    id_manufacturer: { type: 'string', title: 'Manufacturer ID' },
    ean13: { type: 'string', title: 'EAN-13' },
    name: {
        type: 'array',
        title: 'Name',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                value: { type: 'string' }
            }
        }
    },
    date_add: { type: 'string', title: 'Created Date' },
    date_upd: { type: 'string', title: 'Updated Date' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Products' });
        }

        const data = await lib.psRequest(context, {
            path: '/products',
            params: {
                display: 'full',
                limit: 100,
                sort: '[id_DESC]'
            }
        });

        const records = data.products || [];

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
