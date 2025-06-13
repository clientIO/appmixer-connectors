
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { invoice_item_id, description } = context.messages.in.content;

        // https://stripe.com/docs/api/invoiceitems/update
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/invoiceitems/{invoice_item_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
