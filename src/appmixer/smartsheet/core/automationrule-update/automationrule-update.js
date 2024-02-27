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

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}/automationrules/${input['automationRuleId']}`;

        const headers = {};

        const inputMapping = {
            'id': input['id'],
            'action': input['action'],
            'createdAt': input['createdAt'],
            'disabledReason': input['disabledReason'],
            'disabledReasonText': input['disabledReasonText'],
            'enabled': input['enabled'],
            'modifiedAt': input['modifiedAt'],
            'name': input['name'],
            'userCanModify': input['userCanModify'],
            'createdBy.email': input['createdBy|email'],
            'createdBy.name': input['createdBy|name'],
            'modifiedBy.email': input['modifiedBy|email'],
            'modifiedBy.name': input['modifiedBy|name']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

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
