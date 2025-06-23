
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { templateId, newDocumentName, replacements, imageReplacements } = context.messages.in.content;

        // https://developers.google.com/drive/api/v3/reference/files/copy
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://www.googleapis.com/drive/v3/files/{templateId}/copy',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
