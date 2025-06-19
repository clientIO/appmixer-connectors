'use strict';

module.exports = {
    async receive(context) {

        const intentId = context.messages.in.content.payment_intent_id;
        const amount = context.messages.in.content.amount_to_capture;

        // https://stripe.com/docs/api/payment_intents/capture
        const requestData = {};
        if (amount !== '' && amount !== undefined) {
            requestData.amount_to_capture = amount;
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.stripe.com/v1/payment_intents/${intentId}/capture`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: requestData
        });

        return context.sendJson(data, 'out');
    }
};
