
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { custom_endpoint, method, parameters } = context.messages.in.content;

        // https://stripe.com/docs/api
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/{custom_endpoint}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
