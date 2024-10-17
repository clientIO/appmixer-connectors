'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets/${input['ticket_id']}`;

        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'DELETE',
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return context.sendJson({ data }, 'out');
    }
};
