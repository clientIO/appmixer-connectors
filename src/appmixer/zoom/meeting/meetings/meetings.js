'use strict';

const lib = require('../../lib');

module.exports = {

    httpRequest: async function(context, override = {}) {

        const input = context.messages.in.content;


        let url = lib.getBaseUrl(context) + `/users/${input['userId']}/meetings`;

        const headers = {};
        const query = new URLSearchParams;


        const queryParameters = { 'type': input['type'],
            'page_size': input['page_size'],
            'next_page_token': input['next_page_token'],
            'page_number': input['page_number'] };

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

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

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

    receive: async function(context) {


        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }


        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const query = {
            'page_size':  20
        };
        let data;
        let result;
        let hasMore;
        let needMore;
        let page;
        let cursor;

        // Get first page.
        ({ data } = await this.httpRequest(context, { query }));
        const pageExpression = lib.jsonata('meetings');
        page = await pageExpression.evaluate(data);
        result = page.slice(0, limit);

        const cursorExpression = lib.jsonata('next_page_token');
        cursor = await cursorExpression.evaluate(data);

        hasMore = result.length > 0 && Boolean(cursor);
        needMore = result.length < limit;
        // Failsafe in case the 3rd party API doesn't behave correctly, to prevent infinite loop.
        let failsafe = 0;
        // Repeat for other pages.
        while (hasMore && needMore && failsafe < limit) {
            query['next_page_token'] = cursor;
            ({ data } = await this.httpRequest(context, { query }));
            page = await pageExpression.evaluate(data);
            result = result.concat(page);
            cursor = await cursorExpression.evaluate(data);
            hasMore = page.length > 0 && Boolean(cursor);
            needMore = result.length < limit;
            failsafe += 1;
        }

        if (context.messages.in.content.xConnectorOutputType === 'object') {
            return context.sendArray(result, 'out');
        } else {
            // array
            return context.sendJson({ result }, 'out');
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
                'description': 'List of Meeting objects.',
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'agenda': {
                            'description': 'Meeting description. The length of agenda gets truncated to 250 characters when you list all meetings for a user. To view the complete agenda of a meeting, retrieve details for a single meeting, use the [**Get a meeting**](/docs/api-reference/zoom-api/methods#operation/meeting) API.',
                            'type': 'string',
                            'example': 'My Meeting'
                        },
                        'created_at': {
                            'description': 'Time of creation. ',
                            'format': 'date-time',
                            'type': 'string',
                            'example': '2022-03-23T05:31:16Z'
                        },
                        'duration': {
                            'description': 'Meeting duration.',
                            'type': 'integer',
                            'example': 60
                        },
                        'host_id': {
                            'description': 'ID of the user who is set as the host of the meeting.',
                            'type': 'string',
                            'example': '30R7kT7bTIKSNUFEuH_Qlg'
                        },
                        'id': {
                            'description': 'Meeting ID - also known as the meeting number in long (int64) format.',
                            'type': 'integer',
                            'example': 97763643886
                        },
                        'join_url': {
                            'description': 'URL using which participants can join a meeting.',
                            'type': 'string',
                            'example': 'https://example.com/j/11111'
                        },
                        'pmi': {
                            'description': '[Personal meeting ID](https://marketplace.zoom.us/docs/api-reference/using-zoom-apis/#understanding-personal-meeting-id-pmi). This field is only returned if PMI was used to schedule the meeting.',
                            'type': 'string',
                            'example': '97891943927'
                        },
                        'start_time': {
                            'description': 'Meeting start time.',
                            'format': 'date-time',
                            'type': 'string',
                            'example': '2022-03-23T06:00:00Z'
                        },
                        'timezone': {
                            'description': 'Timezone to format the meeting start time. ',
                            'type': 'string',
                            'example': 'America/Los_Angeles'
                        },
                        'topic': {
                            'description': 'Meeting topic.',
                            'type': 'string',
                            'example': 'My Meeting'
                        },
                        'type': {
                            'description': 'Meeting Types:<br>`1` - Instant meeting.<br>`2` - Scheduled meeting.<br>`3` - Recurring meeting with no fixed time.<br>`8` - Recurring meeting with fixed time.',
                            'enum': [
                                1,
                                2,
                                3,
                                8
                            ],
                            'type': 'integer',
                            'x-enum-descriptions': [
                                'Instant Meeting',
                                'Scheduled Meeting',
                                'Recurring Meeting with no fixed time',
                                'Recurring Meeting with fixed time'
                            ],
                            'example': 2
                        },
                        'uuid': {
                            'description': 'Unique Meeting ID. Each meeting instance will generate its own Meeting UUID.',
                            'type': 'string',
                            'example': 'aDYlohsHRtCd4ii1uC2+hA=='
                        }
                    }
                }
            }
        }
    ],

    objectOutputOptions: [
        {
            'label': 'Agenda',
            'value': 'agenda'
        },
        {
            'label': 'Created At',
            'value': 'created_at'
        },
        {
            'label': 'Duration',
            'value': 'duration'
        },
        {
            'label': 'Host Id',
            'value': 'host_id'
        },
        {
            'label': 'Id',
            'value': 'id'
        },
        {
            'label': 'Join Url',
            'value': 'join_url'
        },
        {
            'label': 'Pmi',
            'value': 'pmi'
        },
        {
            'label': 'Start Time',
            'value': 'start_time'
        },
        {
            'label': 'Timezone',
            'value': 'timezone'
        },
        {
            'label': 'Topic',
            'value': 'topic'
        },
        {
            'label': 'Type',
            'value': 'type'
        },
        {
            'label': 'Uuid',
            'value': 'uuid'
        }
    ]
};
