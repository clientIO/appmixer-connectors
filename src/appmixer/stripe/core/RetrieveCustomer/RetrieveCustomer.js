
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { customer_id } = context.messages.in.content;

        // https://stripe.com/docs/api/customers/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/customers/{customer_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
