
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { customer_id, email, name, description } = context.messages.in.content;

        // https://stripe.com/docs/api/customers/update
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/customers/{customer_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
