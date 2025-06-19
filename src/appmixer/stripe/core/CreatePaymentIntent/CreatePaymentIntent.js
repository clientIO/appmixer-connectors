'use strict';

module.exports = {
    async receive(context) {

        const { amount, currency, paymentMethod, description, customer } = context.messages.in.content;

        // https://stripe.com/docs/api/payment_intents/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/payment_intents',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                amount: amount,
                currency: currency,
                payment_method: paymentMethod,
                description: description,
                customer: customer
            }
        });

        return context.sendJson(data, 'out');
    }
};
