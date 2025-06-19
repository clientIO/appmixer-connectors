
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { customer, collectionMethod, description } = context.messages.in.content;

        // https://stripe.com/docs/api/invoices/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/invoices',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                customer: customer,
                collection_method: collectionMethod,
                description: description
            }
        });

        return context.sendJson(data, 'out');
    }
};
