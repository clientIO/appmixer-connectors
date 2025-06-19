
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const id = context.messages.in.content.payment_intent_id;
        const paymentMethod = context.messages.in.content.payment_method;
        // https://stripe.com/docs/api/payment_intents/confirm
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.stripe.com/v1/payment_intents/${id}/confirm`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                payment_method: paymentMethod
            }
        });

        return context.sendJson(data, 'out');
    }
};
