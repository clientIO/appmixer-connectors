'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/organizations`;
        const requestBody = {
            organization: {}
        };
        if (input['organization|name']) {
            requestBody.organization.name = input['organization|name'];
        }
        if (input['organization|details']) {
            requestBody.organization.details = input['organization|details'];
        }
        if (input['organization|notes']) {
            requestBody.organization.notes = input['organization|notes'];
        }
        if (input['organization|tags']) {
            requestBody.organization.tags = input['organization|tags'].split(',').map(tag => tag.trim());
        }
        if (input['organization|domain_names']) {
            requestBody.organization.domain_names = input['organization|domain_names'].split(',').map(tag => tag.trim());
        }
        if (input['organization|external_id']) {
            requestBody.organization.external_id = input['organization|external_id'];
        }
        if (typeof input['organization|shared_tickets'] !== 'undefined') {
            requestBody.organization.shared_tickets = input['organization|shared_tickets'];
        }
        if (typeof input['organization|shared_comments'] !== 'undefined') {
            requestBody.organization.shared_comments = input['organization|shared_comments'];
        }
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
        return context.sendJson({ organization: data.organization }, 'out');
    }
};
