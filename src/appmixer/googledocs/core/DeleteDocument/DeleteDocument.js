
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { documentId } = context.messages.in.content;

        // https://developers.google.com/drive/api/v3/reference/files/delete
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://www.googleapis.com/drive/v3/files/{documentId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
