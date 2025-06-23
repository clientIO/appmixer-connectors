'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { documentId } = context.messages.in.content;

        // Use Google Drive API to delete the document
        // https://developers.google.com/drive/api/v3/reference/files/delete
        await context.httpRequest({
            method: 'DELETE',
            url: `https://www.googleapis.com/drive/v3/files/${documentId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson({
            success: true,
            documentId: documentId
        }, 'out');
    }
};
