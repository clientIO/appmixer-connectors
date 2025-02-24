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

        let url = lib.getBaseUrl(context) + '/models';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {};

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
                    'title': 'Model',
                    'description': 'Describes an OpenAI model offering that can be used with the API.',
                    'required': [
                        'id',
                        'object',
                        'created',
                        'owned_by'
                    ],
                    'x-oaiMeta': {
                        'name': 'The model object',
                        'example': '{\n  "id": "VAR_model_id",\n  "object": "model",\n  "created": 1686935002,\n  "owned_by": "openai"\n}\n'
                    },
                    'properties': {
                        'id': {
                            'type': 'string',
                            'description': 'The model identifier, which can be referenced in the API endpoints.'
                        },
                        'created': {
                            'type': 'integer',
                            'description': 'The Unix timestamp (in seconds) when the model was created.'
                        },
                        'object': {
                            'type': 'string',
                            'description': 'The object type, which is always "model".',
                            'enum': [
                                'model'
                            ]
                        },
                        'owned_by': {
                            'type': 'string',
                            'description': 'The organization that owns the model.'
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
            'label': 'Created',
            'value': 'created'
        },
        {
            'label': 'Object',
            'value': 'object'
        },
        {
            'label': 'Owned By',
            'value': 'owned_by'
        }
    ]
};
