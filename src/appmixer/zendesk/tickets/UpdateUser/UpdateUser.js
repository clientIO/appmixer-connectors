'use strict';

module.exports = {

    receive: async function(context) {

        const input = context.messages.in.content;
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/users/${input['user|id']}`;
        const requestBody = {
            user: {}
        };
        if (input['user|name']) {
            requestBody.user.name = input['user|name'];
        }
        if (input['user|email']) {
            requestBody.user.email = input['user|email'];
        }
        if (input['user|role']) {
            requestBody.user.role = input['user|role'];
        }
        if (input['user|organization_id']) {
            requestBody.user.organization_id = input['user|organization_id'];
        }
        if (input['user|phone']) {
            requestBody.user.phone = input['user|phone'];
        }
        if (input['user|details']) {
            requestBody.user.details = input['user|details'];
        }
        if (input['user|tags']) {
            requestBody.user.tags = input['user|tags'].split(',').map(tag => tag.trim());
        }
        if (input['user|external_id']) {
            requestBody.user.external_id = input['user|external_id'];
        }
        if (input['user|notes']) {
            requestBody.user.notes = input['user|notes'];
        }
        if (typeof input['user|verified'] !== 'undefined') {
            requestBody.user.verified = input['user|verified'];
        }
        if (input['user|notes']) {
            requestBody.user.notes = input['user|notes'];
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
        return context.sendJson({ user: data.user }, 'out');
    }
};
