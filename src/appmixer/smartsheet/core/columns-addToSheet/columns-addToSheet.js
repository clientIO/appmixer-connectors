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

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}/columns`;

        const headers = {};

        const inputMapping = {
            'title': input['title'],
            'type': input['type'],
            'formula': input['formula'],
            'hidden': input['hidden'],
            'index': input['index'],
            'description': input['description'],
            'format': input['format'],
            'locked': input['locked'],
            'lockedForUser': input['lockedForUser'],
            'options': input['options'],
            'symbol': input['symbol'],
            'systemColumnType': input['systemColumnType'],
            'validation': input['validation'],
            'version': input['version'],
            'width': input['width'],
            'autoNumberFormat.fill': input['autoNumberFormat|fill'],
            'autoNumberFormat.prefix': input['autoNumberFormat|prefix'],
            'autoNumberFormat.startingNumber': input['autoNumberFormat|startingNumber'],
            'autoNumberFormat.suffix': input['autoNumberFormat|suffix'],
            'contactOptions.email': input['contactOptions|email'],
            'contactOptions.name': input['contactOptions|name']
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
