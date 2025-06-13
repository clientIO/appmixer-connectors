
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { invoice_id, description } = context.messages.in.content;

        // https://stripe.com/docs/api/invoices/update
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/invoices/{invoice_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
