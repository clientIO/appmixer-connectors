'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
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
                const { data } = await lib.uploadFile(context, fileId);
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
    }
};
