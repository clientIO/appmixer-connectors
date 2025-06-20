
'use strict';

const lib = require('../../lib.generated');
const schema = {
    id: { type: 'string', title: 'Id' },
    object: { type: 'string', title: 'Object' },
    type: { type: 'string', title: 'Type' },
    customer: { type: 'string', title: 'Customer' },
    created: { type: 'number', title: 'Created (timestamp)' },
    livemode: { type: 'boolean', title: 'Live Mode' },
    card: {
        type: 'object',
        title: 'Card',
        properties: {
            brand: { type: 'string', title: 'Card.Brand' },
            country: { type: 'string', title: 'Card.Country' },
            exp_month: { type: 'number', title: 'Card.Expiration Month' },
            exp_year: { type: 'number', title: 'Card.Expiration Year' },
            last4: { type: 'string', title: 'Card.Last 4 Digits' },
            funding: { type: 'string', title: 'Card.Funding' }
        }
    },
    billing_details: {
        type: 'object',
        title: 'Billing Details',
        properties: {
            name: { type: 'string', title: 'Billing Details.Name' },
            email: { type: 'string', title: 'Billing Details.Email' },
            phone: { type: 'string', title: 'Billing Details.Phone' }
        }
    }
};

module.exports = {
    async receive(context) {

        const { customerId, type, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/payment_methods/list
        const params = {};
        if (customerId) params.customer = customerId;
        if (type) params.type = type;
        params.limit = 100; // Default limit, can be adjusted as needed

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/payment_methods',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: params
        });

        return lib.sendArrayOutput({ context, records:data.data, outputType, arrayPropertyValue: 'data' });
    }
};
