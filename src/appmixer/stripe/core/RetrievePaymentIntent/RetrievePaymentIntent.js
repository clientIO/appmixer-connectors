
'use strict';

module.exports = {
    async receive(context) {

        const { paymentIntentId } = context.messages.in.content;

        // https://stripe.com/docs/api/payment_intents/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return context.sendJson(data, 'out');
    }
};
