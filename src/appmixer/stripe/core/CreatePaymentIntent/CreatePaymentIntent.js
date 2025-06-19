
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { amount, currency, payment_method, description, customer } = context.messages.in.content;

        // https://stripe.com/docs/api/payment_intents/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/payment_intents',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                amount: amount,
                currency: currency,
                payment_method: payment_method,
                description: description,
                customer: customer
            }
        });

        return context.sendJson(data, 'out');
    }
};
