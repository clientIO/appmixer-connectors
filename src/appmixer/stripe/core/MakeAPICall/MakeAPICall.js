
'use strict';

module.exports = {
    async receive(context) {

        const { customEndpoint, method, parameters } = context.messages.in.content;

        // https://stripe.com/docs/api
        const { data } = await context.httpRequest({
            method: method,
            url: `https://api.stripe.com/v1/${customEndpoint}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                ...parameters
            }
        });

        return context.sendJson(data, 'out');
    }
};
