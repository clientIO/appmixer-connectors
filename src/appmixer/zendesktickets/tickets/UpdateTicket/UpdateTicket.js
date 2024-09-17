'use strict';

const mime = require('mime-types');

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

        if (input['ticket|assignee_email']) {
            requestBody.ticket.assignee_email = input['ticket|assignee_email'];
        }
        if (input['ticket|due_at']) {
            requestBody.ticket.due_at = input['ticket|due_at'];
        }
        if (input['ticket|external_id']) {
            requestBody.ticket.external_id = input['ticket|external_id'];
        }
        if (input['ticket|group_id']) {
            requestBody.ticket.group_id = input['ticket|group_id'];
        }
        if (input['ticket|organization_id']) {
            requestBody.ticket.organization_id = input['ticket|organization_id'];
        }
        if (input['ticket|priority']) {
            requestBody.ticket.priority = input['ticket|priority'];
        }
        if (input['ticket|status']) {
            requestBody.ticket.status = input['ticket|status'];
        }
        if (input['ticket|type']) {
            requestBody.ticket.type = input['ticket|type'];
        }
        if (input['ticket|subject']) {
            requestBody.ticket.subject = input['ticket|subject'];
        }
        if (input['ticket|emails_ccs']) {
            requestBody.ticket.email_ccs = input['ticket|emails_ccs'].split(',').map(email => {
                return {
                    user_email: email.trim()
                };
            });
        }
        if (input['ticket|tags']) {
            requestBody.ticket.tags = input['ticket|tags'].split(',').map(tag => tag.trim());
        }
        if (input['ticket|collaborator_emails']) {
            requestBody.ticket.collaborators = input['ticket|collaborator_emails'].split(',').map(c => c.trim());
        }
        if (input['ticket|comment|body_format'] === 'html') {
            requestBody.ticket.comment.html_body = input['ticket|comment|body'];
        } else {
            // text
            requestBody.ticket.comment.body = input['ticket|comment|body'];
        }
        if (input['ticket|requester_email']) {
            requestBody.ticket.requester = {
                email: input['ticket|requester_email']
            };
            // Name cannot be on its own. It must be accompanied by email.
            // On the other hand, email can be on its own.
            if (input['ticket|requester_name']) {
                requestBody.ticket.requester.name = input['ticket|requester_name'];
            }
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
