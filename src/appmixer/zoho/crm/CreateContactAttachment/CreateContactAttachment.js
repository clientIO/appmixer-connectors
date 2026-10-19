'use strict';
const FormData = require('form-data');
const ZohoClient = require('../../ZohoClient');

/**
 * Attach a file to a contact, either an uploaded file or a link to one.
 */
module.exports = {

    async receive(context) {

        const { contactId, fileId, attachmentUrl } = context.messages.in.content;

        if (!contactId) {
            throw new context.CancelError('Contact ID is required!');
        }
        if (!fileId && !attachmentUrl) {
            throw new context.CancelError('Either File or Attachment URL is required!');
        }

        const client = new ZohoClient(context);
        const url = client.path(`/Contacts/${encodeURIComponent(contactId)}/Attachments`);

        // The endpoint takes multipart form data in both cases: the file itself, or a link to it.
        const data = new FormData();
        let stream = null;
        if (fileId) {
            const fileInfo = await context.getFileInfo(fileId);
            stream = await context.getFileReadStream(fileId);
            data.append('file', stream, {
                filename: fileInfo.filename,
                contentType: fileInfo.contentType,
                knownLength: fileInfo.length
            });
        } else {
            data.append('attachmentUrl', attachmentUrl);
        }

        let response;
        try {
            response = await client.request('POST', url, { data, headers: data.getHeaders() });
        } catch (err) {
            // A failed upload leaves the file stream open, one descriptor per attempt.
            stream?.destroy();
            throw err;
        }
        const result = Array.isArray(response?.data) ? response.data[0] : null;

        if (!result || result.status === 'error') {
            throw new Error(result?.message || 'Zoho did not confirm the attachment.');
        }

        return context.sendJson({ contactId, ...result.details }, 'out');
    }
};
