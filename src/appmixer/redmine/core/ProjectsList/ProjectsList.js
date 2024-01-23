'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const { data } = await this.httpRequest(context);
        const resultsExpression = lib.jsonata('projects');
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

        let url = lib.getBaseUrl(context) + '/projects.json';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'offset': input['offset'],
            'include': input['include'] };

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

        headers['X-Redmine-API-Key'] = context.auth.apiKey;

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
                'title': 'Projects',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'title': 'Project',
                    'required': [
                        'id',
                        'name',
                        'identifier',
                        'description',
                        'status',
                        'created_on',
                        'updated_on',
                        'is_public'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'type': 'string'
                        },
                        'identifier': {
                            'title': 'Identifier',
                            'type': 'string'
                        },
                        'description': {
                            'title': 'Description',
                            'type': 'string'
                        },
                        'status': {
                            'title': 'Status',
                            'type': 'integer'
                        },
                        'is_public': {
                            'title': 'IsPublic',
                            'type': 'boolean'
                        },
                        'created_on': {
                            'title': 'CreatedOn',
                            'type': 'string'
                        },
                        'updated_on': {
                            'title': 'UpdatedOn',
                            'type': 'string'
                        },
                        'parent': {
                            'title': 'Parent',
                            'type': 'object',
                            'required': [
                                'id',
                                'name'
                            ],
                            'properties': {
                                'id': {
                                    'title': 'Id',
                                    'type': 'integer'
                                },
                                'name': {
                                    'title': 'Name',
                                    'type': 'string'
                                }
                            }
                        },
                        'issue_categories': {
                            'title': 'IssueCategories',
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'required': [
                                    'id',
                                    'name'
                                ],
                                'properties': {
                                    'id': {
                                        'title': 'Id',
                                        'type': 'integer'
                                    },
                                    'name': {
                                        'title': 'Name',
                                        'type': 'string'
                                    }
                                }
                            }
                        },
                        'trackers': {
                            'title': 'Trackers',
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'required': [
                                    'id',
                                    'name'
                                ],
                                'properties': {
                                    'id': {
                                        'title': 'Id',
                                        'type': 'integer'
                                    },
                                    'name': {
                                        'title': 'Name',
                                        'type': 'string'
                                    }
                                }
                            }
                        },
                        'enabled_modules': {
                            'title': 'EnabledModules',
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'required': [
                                    'id',
                                    'name'
                                ],
                                'properties': {
                                    'id': {
                                        'title': 'Id',
                                        'type': 'integer'
                                    },
                                    'name': {
                                        'title': 'Name',
                                        'type': 'string'
                                    }
                                }
                            }
                        },
                        'time_entry_activities': {
                            'title': 'TimeEntryActivities',
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'required': [
                                    'id',
                                    'name'
                                ],
                                'properties': {
                                    'id': {
                                        'title': 'Id',
                                        'type': 'integer'
                                    },
                                    'name': {
                                        'title': 'Name',
                                        'type': 'string'
                                    }
                                }
                            }
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
        },
        {
            'label': 'Identifier',
            'value': 'identifier'
        },
        {
            'label': 'Description',
            'value': 'description'
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Is Public',
            'value': 'is_public'
        },
        {
            'label': 'Created On',
            'value': 'created_on'
        },
        {
            'label': 'Updated On',
            'value': 'updated_on'
        },
        {
            'label': 'Parent',
            'value': 'parent'
        },
        {
            'label': 'Parent Id',
            'value': 'parent.id'
        },
        {
            'label': 'Parent Name',
            'value': 'parent.name'
        },
        {
            'label': 'Issue Categories',
            'value': 'issue_categories',
            'schema': {
                'title': 'IssueCategories',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'required': [
                        'id',
                        'name'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'type': 'string'
                        }
                    }
                }
            }
        },
        {
            'label': 'Trackers',
            'value': 'trackers',
            'schema': {
                'title': 'Trackers',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'required': [
                        'id',
                        'name'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'type': 'string'
                        }
                    }
                }
            }
        },
        {
            'label': 'Enabled Modules',
            'value': 'enabled_modules',
            'schema': {
                'title': 'EnabledModules',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'required': [
                        'id',
                        'name'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'type': 'string'
                        }
                    }
                }
            }
        },
        {
            'label': 'Time Entry Activities',
            'value': 'time_entry_activities',
            'schema': {
                'title': 'TimeEntryActivities',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'required': [
                        'id',
                        'name'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'name': {
                            'title': 'Name',
                            'type': 'string'
                        }
                    }
                }
            }
        }
    ]
};
