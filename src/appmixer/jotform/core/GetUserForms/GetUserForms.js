'use strict';

const dependencies = {
    "jsonata": require("jsonata")
};

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const query = {
            'limit': limit,
            'offset': 0
        };
        let data;
        let result;
        let hasMore;
        let needMore;
        let page;

        // Get first page.
        ({
            data
        } = await this.httpRequest(context, {
            query
        }));
        const pageExpression = dependencies.jsonata('content');
        page = await pageExpression.evaluate(data);
        result = page.slice(0, limit);

        hasMore = result.length > 0;
        const countExpression = dependencies.jsonata('resultSet.count');
        let count = await countExpression.evaluate(data);
        hasMore = hasMore && result.length < count;
        needMore = result.length < limit;
        // Failsafe in case the 3rd party API doesn't behave correctly, to prevent infinite loop.
        let failsafe = 0;
        // Repeat for other pages.
        while (hasMore && needMore && failsafe < limit) {
            query['offset'] += 20;
            ({
                data
            } = await this.httpRequest(context, {
                query
            }));
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
            return context.sendJson({
                result
            }, 'out');
        }
    },

    httpRequest: async function(context, override = {}) {

        const input = context.messages.in.content;

        let url = this.getBaseUrl(context) + `/user/forms`;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {
            'orderby': input['orderby'],
            'filter': input['filter']
        };

        if (override && override.query) {
            Object.keys(override.query).forEach(parameter => {
                queryParameters[parameter] = override.query[parameter];
            });
        }

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        query.append('apiKey', context.auth.apiKey);

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

    getBaseUrl: function(context) {

        let url = 'https://{regionPrefix}.jotform.com';
        url = url.replaceAll('{regionPrefix}', context.auth.regionPrefix || 'api');
        return url;
    },

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        } else if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }
    },

    arrayOutputOptions: [{
        "label": "Result",
        "value": "result",
        "schema": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string"
                    },
                    "username": {
                        "type": "string"
                    },
                    "title": {
                        "type": "string"
                    },
                    "height": {
                        "type": "string"
                    },
                    "status": {
                        "type": "string"
                    },
                    "created_at": {
                        "type": "string"
                    },
                    "updated_at": {
                        "type": "string"
                    },
                    "last_submission": {
                        "type": "string"
                    },
                    "new": {
                        "type": "string"
                    },
                    "count": {
                        "type": "string"
                    },
                    "type": {
                        "type": "string"
                    },
                    "favorite": {
                        "type": "number"
                    },
                    "archived": {
                        "type": "number"
                    },
                    "url": {
                        "type": "string"
                    }
                }
            }
        }
    }],

    objectOutputOptions: [{
            "label": "Id",
            "value": "id"
        },
        {
            "label": "Username",
            "value": "username"
        },
        {
            "label": "Title",
            "value": "title"
        },
        {
            "label": "Height",
            "value": "height"
        },
        {
            "label": "Status",
            "value": "status"
        },
        {
            "label": "Created At",
            "value": "created_at"
        },
        {
            "label": "Updated At",
            "value": "updated_at"
        },
        {
            "label": "Last Submission",
            "value": "last_submission"
        },
        {
            "label": "New",
            "value": "new"
        },
        {
            "label": "Count",
            "value": "count"
        },
        {
            "label": "Type",
            "value": "type"
        },
        {
            "label": "Favorite",
            "value": "favorite"
        },
        {
            "label": "Archived",
            "value": "archived"
        },
        {
            "label": "Url",
            "value": "url"
        }
    ]
};