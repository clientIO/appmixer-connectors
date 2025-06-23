
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { documentId } = context.messages.in.content;

        // https://developers.google.com/docs/api/reference/rest/v1/documents/get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://docs.googleapis.com/v1/documents/{documentId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
