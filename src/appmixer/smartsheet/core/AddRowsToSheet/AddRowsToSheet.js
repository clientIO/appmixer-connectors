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

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}/rows`;

        const headers = {};
        const query = new URLSearchParams;

        const inputMapping = [];
        input.rows?.AND?.map(row => {
            let cells = [];
            for (let columnId of Object.keys(row)) {
                cells.push({
                    'columnId': columnId,
                    'value': row[columnId]
                });
            }
            inputMapping.push({
                'cells': cells,
                'toTop': true
            });

        });

        const queryParameters = { 'accessApiLevel': input['accessApiLevel'],
            'allowPartialSuccess': input['allowPartialSuccess'],
            'overrideValidation': input['overrideValidation'] };

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'POST',
            data: inputMapping,
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
