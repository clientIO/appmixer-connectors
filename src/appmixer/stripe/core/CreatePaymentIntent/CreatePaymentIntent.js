
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { amount, currency, customer, payment_method_types, description } = context.messages.in.content;

        // https://stripe.com/docs/api/payment_intents/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/payment_intents',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
