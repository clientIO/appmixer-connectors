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

        let url = lib.getBaseUrl(context) + '/fine_tuning/jobs';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {
            'after': input['after'],
            'limit': input['limit']
        };

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
                    'title': 'FineTuningJob',
                    'description': 'The `fine_tuning.job` object represents a fine-tuning job that has been created through the API.\n',
                    'required': [
                        'created_at',
                        'error',
                        'finished_at',
                        'fine_tuned_model',
                        'hyperparameters',
                        'id',
                        'model',
                        'object',
                        'organization_id',
                        'result_files',
                        'status',
                        'trained_tokens',
                        'training_file',
                        'validation_file'
                    ],
                    'x-oaiMeta': {
                        'name': 'The fine-tuning job object',
                        'example': '{\n  "object": "fine_tuning.job",\n  "id": "ftjob-abc123",\n  "model": "davinci-002",\n  "created_at": 1692661014,\n  "finished_at": 1692661190,\n  "fine_tuned_model": "ft:davinci-002:my-org:custom_suffix:7q8mpxmy",\n  "organization_id": "org-123",\n  "result_files": [\n      "file-abc123"\n  ],\n  "status": "succeeded",\n  "validation_file": null,\n  "training_file": "file-abc123",\n  "hyperparameters": {\n      "n_epochs": 4,\n  },\n  "trained_tokens": 5768\n}\n'
                    },
                    'properties': {
                        'id': {
                            'type': 'string',
                            'description': 'The object identifier, which can be referenced in the API endpoints.'
                        },
                        'created_at': {
                            'type': 'integer',
                            'description': 'The Unix timestamp (in seconds) for when the fine-tuning job was created.'
                        },
                        'error': {
                            'type': 'object',
                            'nullable': true,
                            'description': 'For fine-tuning jobs that have `failed`, this will contain more information on the cause of the failure.',
                            'required': [
                                'code',
                                'message',
                                'param'
                            ],
                            'properties': {
                                'code': {
                                    'type': 'string',
                                    'description': 'A machine-readable error code.'
                                },
                                'message': {
                                    'type': 'string',
                                    'description': 'A human-readable error message.'
                                },
                                'param': {
                                    'type': 'string',
                                    'description': 'The parameter that was invalid, usually `training_file` or `validation_file`. This field will be null if the failure was not parameter-specific.',
                                    'nullable': true
                                }
                            }
                        },
                        'fine_tuned_model': {
                            'type': 'string',
                            'nullable': true,
                            'description': 'The name of the fine-tuned model that is being created. The value will be null if the fine-tuning job is still running.'
                        },
                        'finished_at': {
                            'type': 'integer',
                            'nullable': true,
                            'description': 'The Unix timestamp (in seconds) for when the fine-tuning job was finished. The value will be null if the fine-tuning job is still running.'
                        },
                        'hyperparameters': {
                            'type': 'object',
                            'description': 'The hyperparameters used for the fine-tuning job. See the [fine-tuning guide](/docs/guides/fine-tuning) for more details.',
                            'required': [
                                'n_epochs'
                            ],
                            'properties': {
                                'n_epochs': {
                                    'oneOf': [
                                        {
                                            'type': 'string',
                                            'enum': [
                                                'auto'
                                            ]
                                        },
                                        {
                                            'type': 'integer',
                                            'minimum': 1,
                                            'maximum': 50
                                        }
                                    ],
                                    'default': 'auto',
                                    'description': 'The number of epochs to train the model for. An epoch refers to one full cycle through the training dataset.\n"auto" decides the optimal number of epochs based on the size of the dataset. If setting the number manually, we support any number between 1 and 50 epochs.'
                                }
                            }
                        },
                        'model': {
                            'type': 'string',
                            'description': 'The base model that is being fine-tuned.'
                        },
                        'object': {
                            'type': 'string',
                            'description': 'The object type, which is always "fine_tuning.job".',
                            'enum': [
                                'fine_tuning.job'
                            ]
                        },
                        'organization_id': {
                            'type': 'string',
                            'description': 'The organization that owns the fine-tuning job.'
                        },
                        'result_files': {
                            'type': 'array',
                            'description': 'The compiled results file ID(s) for the fine-tuning job. You can retrieve the results with the [Files API](/docs/api-reference/files/retrieve-contents).',
                            'items': {
                                'type': 'string',
                                'example': 'file-abc123'
                            }
                        },
                        'status': {
                            'type': 'string',
                            'description': 'The current status of the fine-tuning job, which can be either `validating_files`, `queued`, `running`, `succeeded`, `failed`, or `cancelled`.',
                            'enum': [
                                'validating_files',
                                'queued',
                                'running',
                                'succeeded',
                                'failed',
                                'cancelled'
                            ]
                        },
                        'trained_tokens': {
                            'type': 'integer',
                            'nullable': true,
                            'description': 'The total number of billable tokens processed by this fine-tuning job. The value will be null if the fine-tuning job is still running.'
                        },
                        'training_file': {
                            'type': 'string',
                            'description': 'The file ID used for training. You can retrieve the training data with the [Files API](/docs/api-reference/files/retrieve-contents).'
                        },
                        'validation_file': {
                            'type': 'string',
                            'nullable': true,
                            'description': 'The file ID used for validation. You can retrieve the validation results with the [Files API](/docs/api-reference/files/retrieve-contents).'
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
            'label': 'Error',
            'value': 'error'
        },
        {
            'label': 'Error Code',
            'value': 'error.code'
        },
        {
            'label': 'Error Message',
            'value': 'error.message'
        },
        {
            'label': 'Error Param',
            'value': 'error.param'
        },
        {
            'label': 'Fine Tuned Model',
            'value': 'fine_tuned_model'
        },
        {
            'label': 'Finished At',
            'value': 'finished_at'
        },
        {
            'label': 'Hyperparameters',
            'value': 'hyperparameters'
        },
        {
            'label': 'Hyperparameters N Epochs',
            'value': 'hyperparameters.n_epochs'
        },
        {
            'label': 'Model',
            'value': 'model'
        },
        {
            'label': 'Object',
            'value': 'object'
        },
        {
            'label': 'Organization Id',
            'value': 'organization_id'
        },
        {
            'label': 'Result Files',
            'value': 'result_files',
            'schema': {
                'type': 'array',
                'description': 'The compiled results file ID(s) for the fine-tuning job. You can retrieve the results with the [Files API](/docs/api-reference/files/retrieve-contents).',
                'items': {
                    'type': 'string',
                    'example': 'file-abc123'
                }
            }
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Trained Tokens',
            'value': 'trained_tokens'
        },
        {
            'label': 'Training File',
            'value': 'training_file'
        },
        {
            'label': 'Validation File',
            'value': 'validation_file'
        }
    ]
};
