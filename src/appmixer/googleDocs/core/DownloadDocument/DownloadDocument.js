'use strict';

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

        // Generate filename based on document title and format
        let fileName = `document.${format}`;
        try {
            // Try to get document title for better filename
            const docResponse = await context.httpRequest({
                method: 'GET',
                url: `https://www.googleapis.com/drive/v3/files/${documentId}`,
                params: { fields: 'name' },
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });
            if (docResponse.data.name) {
                fileName = `${docResponse.data.name.replace(/[^a-zA-Z0-9\s-_]/g, '')}.${format}`;
            }
        } catch (error) {
            // Use default filename if title fetch fails
        }

        return context.sendJson({
            fileData: data,
            fileName: fileName,
            format: format,
            mimeType: mimeType
        }, 'out');
    }
};
