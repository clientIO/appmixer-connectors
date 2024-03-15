'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson({ columns: data.data }, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}/columns`;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'level': input['level'],
            'includeAll': true };

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
    },
    columnsToSelectArray({ columns }) {

        return columns.map(column => {
            return { label: column.title, value: column.id };
        });
    },
    columnsToInspector({ columns }) {

        if (!columns) {
            throw new Error('There is not a header row in the sheet.');
        }

        // creating inspector template based on: http://jointjs.com/rappid/docs/ui/inspector
        let inspector = {
            inputs: {
                rows: {
                    type: 'expression',
                    label: 'Rows',
                    index: 1,
                    tooltip: 'Rows to Add.',
                    levels: ['AND'],
                    fields: {}
                }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column, i) => {
                const index = i + 1;
                inspector.inputs.rows.fields[column.id] = {
                    type: 'text',
                    label: column.title,
                    index
                };
            });
        }
        return inspector;
    }

};
