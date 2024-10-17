'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets/${input['ticket|id']}`;
        const requestBody = {
            ticket: {}
        };
        if (input['ticket|tags']) {
            requestBody.ticket.tags = input['ticket|tags'].split(',').map(tag => tag.trim());
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
