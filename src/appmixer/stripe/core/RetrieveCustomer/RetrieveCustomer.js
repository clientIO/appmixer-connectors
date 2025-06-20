
'use strict';

module.exports = {
    async receive(context) {

        const { customerId } = context.messages.in.content;

        // https://stripe.com/docs/api/customers/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.stripe.com/v1/customers/${customerId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return context.sendJson(data, 'out');
    }
};
