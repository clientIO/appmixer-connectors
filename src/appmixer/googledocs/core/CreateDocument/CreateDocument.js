
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { title, content } = context.messages.in.content;

        // https://developers.google.com/docs/api/reference/rest/v1/documents/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
