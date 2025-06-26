
'use strict';

module.exports = {
    async receive(context) {

        const { invoiceId } = context.messages.in.content;

        // https://stripe.com/docs/api/invoices/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.stripe.com/v1/invoices/${invoiceId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return context.sendJson(data, 'out');
    }
};
