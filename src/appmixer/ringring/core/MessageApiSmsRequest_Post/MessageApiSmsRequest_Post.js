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

        let url = lib.getBaseUrl(context) + '/sms/v1/message';

        const headers = {};

        const inputMapping = {
            'apiKey': input['apiKey'],
            'to': input['to'],
            'message': input['message'],
            'messageEncoding': input['messageEncoding'],
            'reference': input['reference'],
            'from': input['from'],
            'senderId': input['senderId'],
            'timeScheduled': input['timeScheduled'],
            'timeValidity': input['timeValidity'],
            'replaceIfPresent': input['replaceIfPresent']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

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
