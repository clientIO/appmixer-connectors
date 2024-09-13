'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets`;
        const requestBody = {
            ticket: {
                subject: input['ticket|subject'],
                comment: {
                    body: input['ticket|comment|body']
                },
                assignee_email: input['ticket|assignee_email'],
                due_at: input['ticket|due_at'],
                external_id: input['ticket|external_id'],
                group_id: input['ticket|group_id'],
                organization_id: input['ticket|organization_id'],
                priority: input['ticket|priority'],
                status: input['ticket|status'],
                tags: (input['ticket|tags'] || '').split(',').map(tag => tag.trim()),
                type: input['ticket|type']
            }
        };
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return context.sendJson({ ticket: data.ticket }, 'out');
    }
};
