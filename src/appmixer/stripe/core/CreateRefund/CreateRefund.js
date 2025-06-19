
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { charge, amount, reason } = context.messages.in.content;

        // https://stripe.com/docs/api/refunds/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/refunds',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                charge: charge,
                amount: amount,
                reason: reason
            }
        });

        return context.sendJson(data, 'out');
    }
};
