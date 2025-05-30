
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { amount, currency, method } = context.messages.in.content;

        // https://stripe.com/docs/api/payouts/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/payouts',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
