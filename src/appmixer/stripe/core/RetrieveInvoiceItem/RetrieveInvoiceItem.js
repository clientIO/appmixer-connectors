
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { invoice_item_id } = context.messages.in.content;

        // https://stripe.com/docs/api/invoiceitems/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/invoiceitems/{invoice_item_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
