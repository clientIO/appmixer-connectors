'use strict';

const mime = require('mime-types');

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        // Note that we're using the update_many endpoint in order to update/remove tags without having to first fetch the ticket.
        // See https://developer.zendesk.com/documentation/ticketing/managing-tickets/adding-tags-to-tickets-without-overwriting-existing-tags/.
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets/${input['ticket|id']}`;
        const requestBody = {
            ticket: {
                comment: {
                    public: input['ticket|comment|public']
                }
            }
        };

        if (input['ticket|comment|body_format'] === 'html') {
            requestBody.ticket.comment.html_body = input['ticket|comment|body'];
        } else {
            // text
            requestBody.ticket.comment.body = input['ticket|comment|body'];
        }
        if (input['ticket|attachments']) {
            const fileIds = (input['ticket|attachments'].ADD || [])
                  .map(attachment => (attachment.fileId || null))
                  .filter(fileId => fileId !== null);
            for (const fileId of fileIds) {
                const { data } = await this.uploadFile(context, fileId);
                requestBody.ticket.comment.uploads = requestBody.ticket.comment.uploads || [];
                requestBody.ticket.comment.uploads.push(data.upload.token);
            }
        }

        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };

        const req = {
            url: url,
            method: 'PUT',
            data: requestBody,
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return context.sendJson({ ticket: data.ticket }, 'out');
    },

    uploadFile: async function(context, fileId) {
        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/uploads.json?filename=${fileInfo.filename}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken,
            'Content-Type': mime.lookup(fileInfo.filename) || 'application/octet-stream'
        };
        const req = {
            url: url,
            method: 'POST',
            data: fileStream,
            headers: headers
        };
        return context.httpRequest(req);
    }
};
