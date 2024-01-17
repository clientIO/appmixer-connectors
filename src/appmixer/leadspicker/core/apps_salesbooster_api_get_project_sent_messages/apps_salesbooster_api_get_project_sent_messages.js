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

        let url = lib.getBaseUrl(context) + `/app/sb/api/projects/${input['project_id']}/sent-messages`;

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
                    'title': 'EmailMessageOut',
                    'type': 'object',
                    'required': [
                        'sequence_message',
                        'message_type'
                    ],
                    'properties': {
                        'id': {
                            'title': 'ID',
                            'type': 'integer'
                        },
                        'from_email': {
                            'title': 'From Email',
                            'maxLength': 254,
                            'type': 'string'
                        },
                        'to_email': {
                            'title': 'To Email',
                            'maxLength': 254,
                            'type': 'string'
                        },
                        'subject': {
                            'title': 'Subject',
                            'type': 'string'
                        },
                        'message': {
                            'title': 'Message',
                            'type': 'string'
                        },
                        'status': {
                            'title': 'Status',
                            'default': 'waiting',
                            'type': 'string'
                        },
                        'sent_date': {
                            'title': 'Sent Date',
                            'type': 'string',
                            'format': 'date-time'
                        },
                        'linkedin': {
                            'title': 'Linkedin',
                            'type': 'string'
                        },
                        'opened': {
                            'title': 'Opened',
                            'default': false,
                            'type': 'boolean'
                        },
                        'links_click_count': {
                            'title': 'Links Click Count',
                            'description': 'How many times client clicked the links in email',
                            'default': 0,
                            'type': 'integer'
                        },
                        'sequence_message': {
                            'title': 'Sequence Message',
                            'type': 'integer'
                        },
                        'person': {
                            'title': 'Person',
                            'type': 'integer'
                        },
                        'message_type': {
                            'title': 'Message Type',
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
            'label': 'From Email',
            'value': 'from_email'
        },
        {
            'label': 'To Email',
            'value': 'to_email'
        },
        {
            'label': 'Subject',
            'value': 'subject'
        },
        {
            'label': 'Message',
            'value': 'message'
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Sent Date',
            'value': 'sent_date'
        },
        {
            'label': 'Linkedin',
            'value': 'linkedin'
        },
        {
            'label': 'Opened',
            'value': 'opened'
        },
        {
            'label': 'Links Click Count',
            'value': 'links_click_count'
        },
        {
            'label': 'Sequence Message',
            'value': 'sequence_message'
        },
        {
            'label': 'Person',
            'value': 'person'
        },
        {
            'label': 'Message Type',
            'value': 'message_type'
        }
    ]
};
