
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { payment_intent_id } = context.messages.in.content;

        // https://stripe.com/docs/api/payment_intents/cancel
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/payment_intents/{payment_intent_id}/cancel',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
