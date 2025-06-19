
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const {  } = context.messages.in.content;

        // https://stripe.com/docs/api/balance/retrieve
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/balance',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
