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

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}`;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'accessApiLevel': input['accessApiLevel'],
            'include': input['include'],
            'exclude': input['exclude'],
            'columnIds': input['columnIds'],
            'filterId': input['filterId'],
            'ifVersionAfter': input['ifVersionAfter'],
            'level': input['level'],
            'pageSize': input['pageSize'],
            'page': input['page'],
            'paperSize': input['paperSize'],
            'rowIds': input['rowIds'],
            'rowNumbers': input['rowNumbers'],
            'rowsModifiedSince': input['rowsModifiedSince'] };

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'GET',
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
