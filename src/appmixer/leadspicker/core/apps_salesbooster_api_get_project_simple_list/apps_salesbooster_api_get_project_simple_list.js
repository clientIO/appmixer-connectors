'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const { data } = await this.httpRequest(context);

        if (context.messages.in.content.xConnectorOutputType === 'object') {
            return context.sendArray(data, 'out');
        } else {
            return context.sendJson({ result: data }, 'out');
        }
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/app/sb/api/projects/simple-list';

        const headers = {};

        headers['X-API-Key'] = context.auth.apiKey;

        const req = {
            url: url,
            method: 'GET',
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
    },

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        } else if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }
    },

    arrayOutputOptions: [
        {
            'label': 'Result',
            'value': 'result',
            'schema': {
                'title': 'Response',
                'type': 'array',
                'items': {
                    'title': 'ProjectSimpleOut',
                    'type': 'object',
                    'required': [
                        'name'
                    ],
                    'properties': {
                        'id': {
                            'title': 'ID',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'maxLength': 350,
                            'type': 'string'
                        }
                    }
                }
            }
        }
    ],

    objectOutputOptions: [
        {
            'label': 'Id',
            'value': 'id'
        },
        {
            'label': 'Name',
            'value': 'name'
        }
    ]
};
