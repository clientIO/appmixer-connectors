
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { documentId, mimeType } = context.messages.in.content;

        // https://developers.google.com/drive/api/v3/reference/files/export
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files/{documentId}/export',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
