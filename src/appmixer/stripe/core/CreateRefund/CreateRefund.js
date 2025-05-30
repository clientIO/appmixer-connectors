
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { payment_intent, amount, reason } = context.messages.in.content;

        // https://stripe.com/docs/api/refunds/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/refunds',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
