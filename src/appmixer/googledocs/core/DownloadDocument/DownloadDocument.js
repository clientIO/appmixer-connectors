'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { documentId, format = 'pdf' } = context.messages.in.content;

        // Use Google Drive API to export the document
        // https://developers.google.com/drive/api/v3/reference/files/export
        let mimeType;
        switch (format.toLowerCase()) {
            case 'pdf':
                mimeType = 'application/pdf';
                break;
            case 'txt':
            case 'text':
                mimeType = 'text/plain';
                break;
            case 'html':
                mimeType = 'text/html';
                break;
            case 'docx':
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            case 'odt':
                mimeType = 'application/vnd.oasis.opendocument.text';
                break;
            case 'rtf':
                mimeType = 'application/rtf';
                break;
            case 'epub':
                mimeType = 'application/epub+zip';
                break;
            default:
                mimeType = 'application/pdf';
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://www.googleapis.com/drive/v3/files/${documentId}/export`,
            params: {
                mimeType: mimeType
            },
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            responseType: 'text'
        });

        return context.sendJson({
            content: data,
            format: format,
            mimeType: mimeType
        }, 'out');
    }
};
