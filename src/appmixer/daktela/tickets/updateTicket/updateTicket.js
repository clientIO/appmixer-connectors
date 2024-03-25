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

        let url = lib.getBaseUrl(context) + '/api/v6/tickets.json';

        const headers = {};
        const query = new URLSearchParams;

        const inputMapping = {
            'title': input['title'],
            'sla_deadtime': input['sla_deadtime'],
            'reopen': input['reopen'],
            'user': input['user'],
            'followers': !!input['followers'] ? JSON.parse(input['followers']) : undefined,
            'category': input['category'],
            'priority': input['priority'],
            'stage': input['stage'],
            'statuses': !!input['statuses'] ? JSON.parse(input['statuses']) : undefined,
            'description': input['description'],
            'contact': input['contact'],
            'comment': input['comment'],
            'parentTicket': input['parentTicket']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        query.append('accessToken', context.auth.token);

        const req = {
            url: url,
            method: 'PUT',
            data: requestBody,
            headers: headers
        };

        const queryString = query.toString();
        if (queryString) {
            req.url += '?' + queryString;
        }

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
