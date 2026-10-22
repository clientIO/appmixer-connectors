'use strict';

const lib = require('../../lib.generated');
const schema = {
    'id': { 'type': 'string', 'title': 'Id' },
    'object': { 'type': 'string', 'title': 'Object' },
    'amount': { 'type': 'number', 'title': 'Amount' },
    'currency': { 'type': 'string', 'title': 'Currency' },
    'amount_captured': { 'type': 'number', 'title': 'Amount Captured' },
    'customer': { 'type': 'string', 'title': 'Customer' }
};

module.exports = {
    async receive(context) {

        const { customerId, outputType, paymentIntent } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/charges/list
        const params = {};
        if (customerId) params.customer = customerId;
        if (paymentIntent) params.payment_intent = paymentIntent;
        params.limit = 100; // Default limit, can be adjusted as needed

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/charges',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            // Query filters belong in the query string: Stripe does not read a GET body,
            // so sending them as `data` silently returned unfiltered results.
            params
        });

        // Check if no results found and send to notFound port
        if (!data.data || data.data.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data.data, outputType, arrayPropertyValue: 'data' });
    }
};
