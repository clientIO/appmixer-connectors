'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if ([undefined, null, ''].includes(context.messages.in.content.folderId)) {
            throw new context.CancelError('Folder Id is required!');
        }
        if (!context.messages.in.content.destinationType) {
            throw new context.CancelError('Destination Type is required!');
        }

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/folders/${input['folderId']}/copy`;

        const headers = {};
        const query = new URLSearchParams;

        const inputMapping = {
            'destinationId': input['destinationType'] === 'home' ? null : input['destinationFolderId'] || input['destinationWorkspaceId'],
            'destinationType': input['destinationType'],
            'newName': input['newName']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        const queryParameters = { 'include': input['include'] ? lib.normalizeMultiselectInput(input['include'], context, 'Include') : undefined,
            'exclude': input['exclude'],
            'skipRemap': input['skipRemap'] ? lib.normalizeMultiselectInput(input['skipRemap'], context, 'Skip Remap') : undefined };

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'POST',
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
