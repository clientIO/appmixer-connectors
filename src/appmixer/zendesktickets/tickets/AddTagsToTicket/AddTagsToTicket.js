'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        // Note that we're using the update_many endpoint in order to update/remove tags without having to first fetch the ticket.
        // See https://developer.zendesk.com/documentation/ticketing/managing-tickets/adding-tags-to-tickets-without-overwriting-existing-tags/.
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
