'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit ?? 100;
        const { data } = await this.httpRequest(context);
        const resultsExpression = lib.jsonata('data');
        const result = (await resultsExpression.evaluate(data)).slice(0, limit);

        if (context.messages.in.content.xConnectorOutputType === 'object') {
            return context.sendArray(result, 'out');
        } else {
            // array
            return context.sendJson({ result }, 'out');
        }
    },

    httpRequest: async function(context, override = {}) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/files';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'purpose': input['purpose'] };

        if (override?.query) {
            Object.keys(override.query).forEach(parameter => {
                queryParameters[parameter] = override.query[parameter];
            });
        }

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        headers['Authorization'] = 'Bearer {apiKey}'.replace(/{(.*?)}/g, (match, variable) => context.auth[variable]);

        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };

        if (override.url) req.url = override.url;
        if (override.body) req.data = override.body;
        if (override.headers) req.headers = override.headers;
        if (override.method) req.method = override.method;

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
                'type': 'array',
                'items': {
                    'title': 'OpenAIFile',
                    'description': 'The `File` object represents a document that has been uploaded to OpenAI.',
                    'required': [
                        'id',
                        'object',
                        'bytes',
                        'created_at',
                        'filename',
                        'purpose',
                        'status'
                    ],
                    'x-oaiMeta': {
                        'name': 'The File object',
                        'example': '{\n  "id": "file-abc123",\n  "object": "file",\n  "bytes": 120000,\n  "created_at": 1677610602,\n  "filename": "salesOverview.pdf",\n  "purpose": "assistants",\n}\n'
                    },
                    'properties': {
                        'id': {
                            'type': 'string',
                            'description': 'The file identifier, which can be referenced in the API endpoints.'
                        },
                        'bytes': {
                            'type': 'integer',
                            'description': 'The size of the file, in bytes.'
                        },
                        'created_at': {
                            'type': 'integer',
                            'description': 'The Unix timestamp (in seconds) for when the file was created.'
                        },
                        'filename': {
                            'type': 'string',
                            'description': 'The name of the file.'
                        },
                        'object': {
                            'type': 'string',
                            'description': 'The object type, which is always `file`.',
                            'enum': [
                                'file'
                            ]
                        },
                        'purpose': {
                            'type': 'string',
                            'description': 'The intended purpose of the file. Supported values are `fine-tune`, `fine-tune-results`, `assistants`, and `assistants_output`.',
                            'enum': [
                                'fine-tune',
                                'fine-tune-results',
                                'assistants',
                                'assistants_output'
                            ]
                        },
                        'status': {
                            'type': 'string',
                            'deprecated': true,
                            'description': 'Deprecated. The current status of the file, which can be either `uploaded`, `processed`, or `error`.',
                            'enum': [
                                'uploaded',
                                'processed',
                                'error'
                            ]
                        },
                        'status_details': {
                            'type': 'string',
                            'deprecated': true,
                            'description': 'Deprecated. For details on why a fine-tuning training file failed validation, see the `error` field on `fine_tuning.job`.'
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
            'label': 'Bytes',
            'value': 'bytes'
        },
        {
            'label': 'Created At',
            'value': 'created_at'
        },
        {
            'label': 'Filename',
            'value': 'filename'
        },
        {
            'label': 'Object',
            'value': 'object'
        },
        {
            'label': 'Purpose',
            'value': 'purpose'
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Status Details',
            'value': 'status_details'
        }
    ]
};
