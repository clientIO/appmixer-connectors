'use strict';

module.exports = {
    async receive(context) {

        const id = context.messages.in.content.payment_intent_id;
        const paymentMethod = context.messages.in.content.payment_method;
        // https://stripe.com/docs/api/payment_intents/confirm
        const requestData = {};
        if (paymentMethod) {
            requestData.payment_method = paymentMethod;
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.stripe.com/v1/payment_intents/${id}/confirm`,
            headers: {
            'Authorization': `Bearer ${context.auth.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: requestData
        });

        return context.sendJson(data, 'out');
    }
};
