'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/api/v2/tickets';

        const headers = {};

        const inputMapping = {
            'ticket.additional_collaborators': !!input['ticket|additional_collaborators'] ? JSON.parse(input['ticket|additional_collaborators']) : undefined,
            'ticket.assignee_email': input['ticket|assignee_email'],
            'ticket.assignee_id': input['ticket|assignee_id'],
            'ticket.attribute_value_ids': !!input['ticket|attribute_value_ids'] ? JSON.parse(input['ticket|attribute_value_ids']) : undefined,
            'ticket.collaborator_ids': !!input['ticket|collaborator_ids'] ? JSON.parse(input['ticket|collaborator_ids']) : undefined,
            'ticket.comment': !!input['ticket|comment'] ? JSON.parse(input['ticket|comment']) : undefined,
            'ticket.custom_fields': !!input['ticket|custom_fields'] ? JSON.parse(input['ticket|custom_fields']) : undefined,
            'ticket.custom_status_id': input['ticket|custom_status_id'],
            'ticket.due_at': input['ticket|due_at'],
            'ticket.email_ccs': !!input['ticket|email_ccs'] ? JSON.parse(input['ticket|email_ccs']) : undefined,
            'ticket.external_id': input['ticket|external_id'],
            'ticket.followers': !!input['ticket|followers'] ? JSON.parse(input['ticket|followers']) : undefined,
            'ticket.group_id': input['ticket|group_id'],
            'ticket.organization_id': input['ticket|organization_id'],
            'ticket.priority': input['ticket|priority'],
            'ticket.problem_id': input['ticket|problem_id'],
            'ticket.requester_id': input['ticket|requester_id'],
            'ticket.safe_update': input['ticket|safe_update'],
            'ticket.sharing_agreement_ids': !!input['ticket|sharing_agreement_ids'] ? JSON.parse(input['ticket|sharing_agreement_ids']) : undefined,
            'ticket.status': input['ticket|status'],
            'ticket.subject': input['ticket|subject'],
            'ticket.tags': !!input['ticket|tags'] ? JSON.parse(input['ticket|tags']) : undefined,
            'ticket.type': input['ticket|type'],
            'ticket.updated_stamp': input['ticket|updated_stamp'],
            'ticket.brand_id': input['ticket|brand_id'],
            'ticket.collaborators': !!input['ticket|collaborators'] ? JSON.parse(input['ticket|collaborators']) : undefined,
            'ticket.email_cc_ids': !!input['ticket|email_cc_ids'] ? JSON.parse(input['ticket|email_cc_ids']) : undefined,
            'ticket.follower_ids': !!input['ticket|follower_ids'] ? JSON.parse(input['ticket|follower_ids']) : undefined,
            'ticket.macro_ids': !!input['ticket|macro_ids'] ? JSON.parse(input['ticket|macro_ids']) : undefined,
            'ticket.raw_subject': input['ticket|raw_subject'],
            'ticket.recipient': input['ticket|recipient'],
            'ticket.submitter_id': input['ticket|submitter_id'],
            'ticket.ticket_form_id': input['ticket|ticket_form_id'],
            'ticket.via': !!input['ticket|via'] ? JSON.parse(input['ticket|via']) : undefined,
            'ticket.via_followup_source_id': input['ticket|via_followup_source_id']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };

        try {
            const response = await context.httpRequest(req);
            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return response;
        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    }

};
