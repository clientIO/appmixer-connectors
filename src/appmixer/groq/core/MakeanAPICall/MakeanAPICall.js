
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { method, url, headers, body } = context.messages.in.content;

        // https://console.groq.com/docs/api-reference#api-call
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.groq.com/v1/api/call',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
