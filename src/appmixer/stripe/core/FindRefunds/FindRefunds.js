'use strict';

const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'object':{ 'type':'string','title':'Object' },'amount':{ 'type':'number','title':'Amount' },'status':{ 'type':'string','title':'Status' } };

module.exports = {
    async receive(context) {

        const { charge, outputType, paymentIntent } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/refunds/list
        const params = {};
        if (charge) params.charge = charge;
        if (paymentIntent) params.payment_intent = paymentIntent;
        params.limit = 100; // Default limit, can be adjusted as needed

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/refunds',
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
