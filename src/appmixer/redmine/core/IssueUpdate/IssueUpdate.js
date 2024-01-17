'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        await this.httpRequest(context);

        // http 204 No Content on success
        return context.sendJson({}, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/issues/${input['id']}.json`;

        const headers = {};

        const inputMapping = {
            'issue.project_id': input['issue|project_id'],
            'issue.tracker_id': input['issue|tracker_id'],
            'issue.status_id': input['issue|status_id'],
            'issue.priority_id': input['issue|priority_id'],
            'issue.subject': input['issue|subject'],
            'issue.description': input['issue|description'],
            'issue.category_id': input['issue|category_id'],
            'issue.fixed_version_id': input['issue|fixed_version_id'],
            'issue.assigned_to_id': input['issue|assigned_to_id'],
            'issue.parent_issue_id': input['issue|parent_issue_id'],
            'issue.custom_fields': input['issue|custom_fields'],
            'issue.watcher_user_ids': input['issue|watcher_user_ids'],
            'issue.is_private': input['issue|is_private'],
            'issue.estimated_hours': input['issue|estimated_hours'],
            'issue.notes': input['issue|notes'],
            'issue.private_notes': input['issue|private_notes']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        headers['X-Redmine-API-Key'] = context.auth.apiKey;

        const req = {
            url: url,
            method: 'PUT',
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
