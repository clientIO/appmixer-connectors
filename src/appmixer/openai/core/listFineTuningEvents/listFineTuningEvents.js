'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
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

        let url = lib.getBaseUrl(context) + `/fine_tuning/jobs/${input['fine_tuning_job_id']}/events`;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'after': input['after'],
            'limit': input['limit'] };

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
                    'type': 'object',
                    'description': 'Fine-tuning job event object',
                    'required': [
                        'id',
                        'object',
                        'created_at',
                        'level',
                        'message'
                    ],
                    'x-oaiMeta': {
                        'name': 'The fine-tuning job event object',
                        'example': '{\n  "object": "fine_tuning.job.event",\n  "id": "ftevent-abc123"\n  "created_at": 1677610602,\n  "level": "info",\n  "message": "Created fine-tuning job"\n}\n'
                    },
                    'properties': {
                        'id': {
                            'type': 'string'
                        },
                        'created_at': {
                            'type': 'integer'
                        },
                        'level': {
                            'type': 'string',
                            'enum': [
                                'info',
                                'warn',
                                'error'
                            ]
                        },
                        'message': {
                            'type': 'string'
                        },
                        'object': {
                            'type': 'string',
                            'enum': [
                                'fine_tuning.job.event'
                            ]
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
            'label': 'Created At',
            'value': 'created_at'
        },
        {
            'label': 'Level',
            'value': 'level'
        },
        {
            'label': 'Message',
            'value': 'message'
        },
        {
            'label': 'Object',
            'value': 'object'
        }
    ]
};
