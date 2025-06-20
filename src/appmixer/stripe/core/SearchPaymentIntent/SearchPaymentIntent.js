'use strict';

const lib = require('../../lib.generated');

const schema = {
    id: { type: 'string', title: 'Payment Intent ID' },
    object: { type: 'string', title: 'Object Type' },
    amount: { type: 'number', title: 'Amount' },
    amount_capturable: { type: 'number', title: 'Amount Capturable' },
    amount_received: { type: 'number', title: 'Amount Received' },
    currency: { type: 'string', title: 'Currency' },
    status: { type: 'string', title: 'Status' },
    created: { type: 'number', title: 'Created (Unix Timestamp)' },
    livemode: { type: 'boolean', title: 'Live Mode' },
    customer: { type: ['string', 'null'], title: 'Customer ID' },
    description: { type: ['string', 'null'], title: 'Description' }
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

        // Stripe: https://stripe.com/docs/api/payment_intents/search
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/payment_intents/search',
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
