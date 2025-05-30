
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { transaction_id } = context.messages.in.content;

        // https://stripe.com/docs/api/balance_transactions/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/balance_transactions/{transaction_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
