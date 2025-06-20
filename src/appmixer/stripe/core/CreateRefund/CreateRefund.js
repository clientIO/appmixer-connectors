'use strict';

module.exports = {
    async receive(context) {

        const { charge, amount, reason } = context.messages.in.content;

        // https://stripe.com/docs/api/refunds/create
        const formData = {};
        if (charge) formData.charge = charge;
        if (amount !== undefined && amount !== '') formData.amount = amount;
        if (reason) formData.reason = reason;

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/refunds',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: formData
        });

        return context.sendJson(data, 'out');
    }
};
