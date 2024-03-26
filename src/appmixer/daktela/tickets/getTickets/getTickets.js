'use strict';

const lib = require('../../lib');
const qs = require('qs');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const query = {
            'take':  10 ,
            'skip': 0
        };
        let data;
        let result;
        let hasMore;
        let needMore;
        let page;

        // Get first page.
        ({ data } = await this.httpRequest(context, { query }));
        const pageExpression = lib.jsonata('result.data');
        page = await pageExpression.evaluate(data);
        result = page.slice(0, limit);

        hasMore = result.length > 0;
        const countExpression = lib.jsonata('total');
        let count = await countExpression.evaluate(data);
        hasMore = hasMore && result.length < count;
        needMore = result.length < limit;
        // Failsafe in case the 3rd party API doesn't behave correctly, to prevent infinite loop.
        let failsafe = 0;
        // Repeat for other pages.
        while (hasMore && needMore && failsafe < limit) {
            query['skip'] += 10;
            ({ data } = await this.httpRequest(context, { query }));
            page = await pageExpression.evaluate(data);
            result = result.concat(page);
            hasMore = page.length > 0;
            count = await countExpression.evaluate(data);
            hasMore = hasMore && result.length < count;
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

    httpRequest: async function(context, override = {}) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/api/v6/tickets.json';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {
            q: input['q']
            // 'filter': input['filter'], Done separately
            // 'sort': input['sort'], Done separately
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

        query.append('accessToken', context.auth.token);

        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };

        if (override.url) req.url = override.url;
        if (override.body) req.data = override.body;
        if (override.headers) req.headers = override.headers;
        if (override.method) req.method = override.method;

        let queryString = query.toString();
        const inputFilter = input['filter']?.trim();
        if (inputFilter) {
            try {
                const filterObject = JSON.parse(input['filter']);
                const qsFilter = qs.stringify(filterObject, { encode: true });
                if (qsFilter) {
                    queryString += '&' + qsFilter;
                }
            } catch (e) {
                // context.log({ step: 'Error parsing filter object', error: e });
                throw new context.CancelError('Error parsing filter object', e);
            }
        }

        const inputSort = input['sort']?.trim();
        if (inputSort) {
            try {
                const sortObject = JSON.parse(input['sort']);
                const qsSort = qs.stringify(sortObject, { encode: true });
                if (qsSort) {
                    queryString += '&' + qsSort;
                }
            } catch (e) {
                // context.log({ step: 'Error parsing sort object', error: e });
                throw new context.CancelError('Error parsing sort object', e);
            }
        }

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
                    'properties': {
                        'name': {
                            'type': 'integer',
                            'description': 'Unique name'
                        },
                        'title': {
                            'type': 'string',
                            'description': 'Subject of ticket'
                        },
                        'id_merge': {
                            'type': 'string',
                            'description': 'Merge ID'
                        },
                        'category': {
                            'type': 'string',
                            'description': 'Category'
                        },
                        'user': {
                            'type': 'string',
                            'description': 'User'
                        },
                        'email': {
                            'type': 'string',
                            'format': 'email',
                            'description': 'Email'
                        },
                        'contact': {
                            'type': 'string',
                            'description': 'Contact'
                        },
                        'parentTicket': {
                            'type': 'string',
                            'description': 'Parent ticket'
                        },
                        'isParent': {
                            'type': 'boolean',
                            'description': 'Parent flag'
                        },
                        'description': {
                            'type': 'string',
                            'description': 'Optional description'
                        },
                        'stage': {
                            'type': 'string',
                            'enum': [
                                'OPEN',
                                'WAIT',
                                'CLOSE'
                            ],
                            'description': 'Stage'
                        },
                        'priority': {
                            'type': 'string',
                            'enum': [
                                'LOW',
                                'MEDIUM',
                                'HIGH'
                            ],
                            'description': 'Level of priority'
                        },
                        'sla_overdue': {
                            'type': 'integer',
                            'description': 'SLA overdue in seconds'
                        },
                        'sla_deadtime': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Deadline'
                        },
                        'sla_close_deadline': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Ticket deadline'
                        },
                        'sla_change': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Sla change'
                        },
                        'sla_duration': {
                            'type': 'integer',
                            'description': 'Sla duration'
                        },
                        'sla_custom': {
                            'type': 'boolean',
                            'description': 'Sla custom'
                        },
                        'interaction_activity_count': {
                            'type': 'integer',
                            'description': 'Activity count'
                        },
                        'reopen': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Reopen'
                        },
                        'created': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Date of creation'
                        },
                        'created_by': {
                            'type': 'string',
                            'description': 'Created by'
                        },
                        'edited': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Date of last modification'
                        },
                        'edited_by': {
                            'type': 'string',
                            'description': 'Edited by'
                        },
                        'first_answer': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Date of first answer'
                        },
                        'first_answer_duration': {
                            'type': 'integer',
                            'description': 'First answer duration'
                        },
                        'first_answer_deadline': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'First answer deadline'
                        },
                        'first_answer_overdue': {
                            'type': 'integer',
                            'description': 'First answer overdue in seconds'
                        },
                        'closed': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Date when the ticket was closed'
                        },
                        'unread': {
                            'type': 'boolean',
                            'description': 'Unread'
                        },
                        'has_attachment': {
                            'type': 'boolean',
                            'description': 'Has attachment'
                        },
                        'followers': {
                            'type': 'string',
                            'description': 'Followers'
                        },
                        'statuses': {
                            'type': 'string',
                            'description': 'Statuses'
                        },
                        'last_activity': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Last Activity'
                        },
                        'last_activity_operator': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Last Activity of Operator'
                        },
                        'last_activity_client': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'Last Activity of Client'
                        },
                        'customFields': {
                            'type': 'string',
                            'description': 'Custom fields'
                        }
                    }
                }
            }
        }
    ],

    objectOutputOptions: [
        {
            'label': 'Name',
            'value': 'name'
        },
        {
            'label': 'Title',
            'value': 'title'
        },
        {
            'label': 'Id Merge',
            'value': 'id_merge'
        },
        {
            'label': 'Category',
            'value': 'category'
        },
        {
            'label': 'User',
            'value': 'user'
        },
        {
            'label': 'Email',
            'value': 'email'
        },
        {
            'label': 'Contact',
            'value': 'contact'
        },
        {
            'label': 'Parent Ticket',
            'value': 'parentTicket'
        },
        {
            'label': 'Is Parent',
            'value': 'isParent'
        },
        {
            'label': 'Description',
            'value': 'description'
        },
        {
            'label': 'Stage',
            'value': 'stage'
        },
        {
            'label': 'Priority',
            'value': 'priority'
        },
        {
            'label': 'Sla Overdue',
            'value': 'sla_overdue'
        },
        {
            'label': 'Sla Deadtime',
            'value': 'sla_deadtime'
        },
        {
            'label': 'Sla Close Deadline',
            'value': 'sla_close_deadline'
        },
        {
            'label': 'Sla Change',
            'value': 'sla_change'
        },
        {
            'label': 'Sla Duration',
            'value': 'sla_duration'
        },
        {
            'label': 'Sla Custom',
            'value': 'sla_custom'
        },
        {
            'label': 'Interaction Activity Count',
            'value': 'interaction_activity_count'
        },
        {
            'label': 'Reopen',
            'value': 'reopen'
        },
        {
            'label': 'Created',
            'value': 'created'
        },
        {
            'label': 'Created By',
            'value': 'created_by'
        },
        {
            'label': 'Edited',
            'value': 'edited'
        },
        {
            'label': 'Edited By',
            'value': 'edited_by'
        },
        {
            'label': 'First Answer',
            'value': 'first_answer'
        },
        {
            'label': 'First Answer Duration',
            'value': 'first_answer_duration'
        },
        {
            'label': 'First Answer Deadline',
            'value': 'first_answer_deadline'
        },
        {
            'label': 'First Answer Overdue',
            'value': 'first_answer_overdue'
        },
        {
            'label': 'Closed',
            'value': 'closed'
        },
        {
            'label': 'Unread',
            'value': 'unread'
        },
        {
            'label': 'Has Attachment',
            'value': 'has_attachment'
        },
        {
            'label': 'Followers',
            'value': 'followers'
        },
        {
            'label': 'Statuses',
            'value': 'statuses'
        },
        {
            'label': 'Last Activity',
            'value': 'last_activity'
        },
        {
            'label': 'Last Activity Operator',
            'value': 'last_activity_operator'
        },
        {
            'label': 'Last Activity Client',
            'value': 'last_activity_client'
        },
        {
            'label': 'Custom Fields',
            'value': 'customFields'
        }
    ]
};
