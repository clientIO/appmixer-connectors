'use strict';

const lib = require('../../lib.generated');

const schema = {
    id: { type: 'string', title: 'Customer ID' },
    object: { type: 'string', title: 'Object Type' },
    name: { type: 'string', title: 'Name' },
    email: { type: 'string', title: 'Email' },
    phone: { type: 'string', title: 'Phone' },
    description: { type: 'string', title: 'Description' },
    balance: { type: 'number', title: 'Balance' },
    created: { type: 'number', title: 'Created (Unix Timestamp)' },
    currency: { type: ['string', 'null'], title: 'Currency' },
    invoicePrefix: { type: 'string', title: 'Invoice Prefix' },
    livemode: { type: 'boolean', title: 'Live Mode' },
    defaultSource: { type: ['string', 'null'], title: 'Default Source' },
    delinquent: { type: 'boolean', title: 'Delinquent' },
    nextInvoiceSequence: { type: 'number', title: 'Next Invoice Sequence' },
    taxExempt: { type: 'string', title: 'Tax Exempt' },
    address: {
        type: 'object',
        title: 'Address',
        properties: {
            city: { type: ['string', 'null'], title: 'City' },
            country: { type: ['string', 'null'], title: 'Country' },
            line1: { type: ['string', 'null'], title: 'Line 1' },
            line2: { type: ['string', 'null'], title: 'Line 2' },
            postal_code: { type: ['string', 'null'], title: 'Postal Code' },
            state: { type: ['string', 'null'], title: 'State' }
        }
    }
};

module.exports = {
    async receive(context) {
        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, {
                label: 'data',
                value: 'data'
            });
        }

        // Stripe: https://stripe.com/docs/api/customers/search
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/customers/search',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: {
                query,
                limit: 100 // Default limit, can be adjusted as needed
            }
        });

        return lib.sendArrayOutput({
            context,
            records: data.data,
            outputType,
            arrayPropertyValue: 'data'
        });
    }
};
