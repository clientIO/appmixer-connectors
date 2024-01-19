'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const { data } = await this.httpRequest(context);
        const resultsExpression = lib.jsonata('issues');
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

        let url = lib.getBaseUrl(context) + '/issues.json';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'offset': input['offset'],
            'sort': input['sort'],
            'include': input['include'],
            'issue_id': input['issue_id'],
            'project_id': input['project_id'],
            'subproject_id': input['subproject_id'],
            'tracker_id': input['tracker_id'],
            'status_id': input['status_id'],
            'assigned_to_id': input['assigned_to_id'] };

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
                'title': 'Issues',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'title': 'Issue',
                    'required': [
                        'id',
                        'project',
                        'tracker',
                        'status',
                        'priority',
                        'author',
                        'subject',
                        'description',
                        'start_date',
                        'due_date',
                        'done_ratio',
                        'is_private',
                        'estimated_hours',
                        'created_on',
                        'updated_on',
                        'closed_on'
                    ],
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'project': {
                            'title': 'Project',
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
                        'tracker': {
                            'title': 'Tracker',
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
                        'status': {
                            'title': 'Status',
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
                        'priority': {
                            'title': 'Priority',
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
                        'author': {
                            'title': 'Author',
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
                        'assigned_to': {
                            'title': 'AssignedTo',
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
                        'subject': {
                            'title': 'Subject',
                            'type': 'string'
                        },
                        'description': {
                            'title': 'Description',
                            'type': 'string'
                        },
                        'start_date': {
                            'title': 'StartDate',
                            'type': 'string'
                        },
                        'due_date': {
                            'title': 'DueDate',
                            'type': 'string'
                        },
                        'done_ratio': {
                            'title': 'DoneRatio',
                            'type': 'integer'
                        },
                        'is_private': {
                            'title': 'Is Private',
                            'type': 'boolean'
                        },
                        'estimated_hours': {
                            'title': 'EstimatedHours',
                            'type': 'number',
                            'example': 1.5
                        },
                        'created_on': {
                            'title': 'CreatedOn',
                            'type': 'string'
                        },
                        'updated_on': {
                            'title': 'UpdatedOn',
                            'type': 'string'
                        },
                        'closed_on': {
                            'title': 'ClosedOn',
                            'type': 'string'
                        },
                        'children': {
                            'title': 'Children',
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
                        'attachments': {
                            'title': 'Attachments',
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
                        'relations': {
                            'title': 'Realtions',
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
                        'changesets': {
                            'title': 'Chagesets',
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
                        'journals': {
                            'title': 'Journals',
                            'type': 'array',
                            'items': {
                                'title': 'Journal',
                                'type': 'object',
                                'properties': {
                                    'id': {
                                        'title': 'Id',
                                        'type': 'integer'
                                    },
                                    'user': {
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
                                    'notes': {
                                        'type': 'string'
                                    },
                                    'created_on': {
                                        'type': 'string'
                                    },
                                    'private_notes': {
                                        'type': 'boolean'
                                    },
                                    'details': {
                                        'type': 'array',
                                        'items': {
                                            'type': 'object',
                                            'properties': {
                                                'property': {
                                                    'type': 'string'
                                                },
                                                'name': {
                                                    'type': 'string'
                                                },
                                                'old_value': {
                                                    'type': 'string'
                                                },
                                                'new_value': {
                                                    'type': 'string'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        'watchers': {
                            'title': 'Watchers',
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
            'label': 'Project',
            'value': 'project'
        },
        {
            'label': 'Project Id',
            'value': 'project.id'
        },
        {
            'label': 'Project Name',
            'value': 'project.name'
        },
        {
            'label': 'Tracker',
            'value': 'tracker'
        },
        {
            'label': 'Tracker Id',
            'value': 'tracker.id'
        },
        {
            'label': 'Tracker Name',
            'value': 'tracker.name'
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Status Id',
            'value': 'status.id'
        },
        {
            'label': 'Status Name',
            'value': 'status.name'
        },
        {
            'label': 'Priority',
            'value': 'priority'
        },
        {
            'label': 'Priority Id',
            'value': 'priority.id'
        },
        {
            'label': 'Priority Name',
            'value': 'priority.name'
        },
        {
            'label': 'Author',
            'value': 'author'
        },
        {
            'label': 'Author Id',
            'value': 'author.id'
        },
        {
            'label': 'Author Name',
            'value': 'author.name'
        },
        {
            'label': 'Assigned To',
            'value': 'assigned_to'
        },
        {
            'label': 'Assigned To Id',
            'value': 'assigned_to.id'
        },
        {
            'label': 'Assigned To Name',
            'value': 'assigned_to.name'
        },
        {
            'label': 'Subject',
            'value': 'subject'
        },
        {
            'label': 'Description',
            'value': 'description'
        },
        {
            'label': 'Start Date',
            'value': 'start_date'
        },
        {
            'label': 'Due Date',
            'value': 'due_date'
        },
        {
            'label': 'Done Ratio',
            'value': 'done_ratio'
        },
        {
            'label': 'Is Private',
            'value': 'is_private'
        },
        {
            'label': 'Estimated Hours',
            'value': 'estimated_hours'
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
            'label': 'Closed On',
            'value': 'closed_on'
        },
        {
            'label': 'Children',
            'value': 'children',
            'schema': {
                'title': 'Children',
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
            'label': 'Attachments',
            'value': 'attachments',
            'schema': {
                'title': 'Attachments',
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
            'label': 'Relations',
            'value': 'relations',
            'schema': {
                'title': 'Realtions',
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
            'label': 'Changesets',
            'value': 'changesets',
            'schema': {
                'title': 'Chagesets',
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
            'label': 'Journals',
            'value': 'journals',
            'schema': {
                'title': 'Journals',
                'type': 'array',
                'items': {
                    'title': 'Journal',
                    'type': 'object',
                    'properties': {
                        'id': {
                            'title': 'Id',
                            'type': 'integer'
                        },
                        'user': {
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
                        'notes': {
                            'type': 'string'
                        },
                        'created_on': {
                            'type': 'string'
                        },
                        'private_notes': {
                            'type': 'boolean'
                        },
                        'details': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'property': {
                                        'type': 'string'
                                    },
                                    'name': {
                                        'type': 'string'
                                    },
                                    'old_value': {
                                        'type': 'string'
                                    },
                                    'new_value': {
                                        'type': 'string'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            'label': 'Watchers',
            'value': 'watchers',
            'schema': {
                'title': 'Watchers',
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
