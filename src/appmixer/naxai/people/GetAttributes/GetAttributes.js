'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { isSource } = context.messages.in.content;

        const cacheKey = 'naxai_attributes_' + context.auth.clientId;
        let lock;
        try {
            lock = await context.lock(context.auth.clientId);

            // Checking and returning cache only if this is a call from another component.
            if (isSource) {
                const basesCached = await context.staticCache.get(cacheKey);
                if (basesCached) {
                    return context.sendJson({ items: basesCached }, 'out');
                }
            }

            const { data } = await this.httpRequest(context);
            // Response exaple: [{ "name": "newKey" }, { "name": "newKey-2" }]

            // Cache the tables for 20 seconds unless specified otherwise in the config.
            // Note that we only need name and id, so we can save some space in the cache.
            // Caching only if this is a call from another component.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    data.map(item => ({ id: item.name, name: item.name })),
                    context.config.listAttributesCacheTTL || (20 * 1000)
                );

                // Returning values into another component.
                return context.sendJson({ items: data }, 'out');
            }

            // Returning values to the flow.
            if (context.messages.in.content.xConnectorOutputType === 'object') {
                return context.sendArray(data, 'out');
            } else {
                return context.sendJson({ result: data }, 'out');
            }
        } finally {
            lock?.unlock();
        }
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/people/attributes';

        const headers = {
            'X-Client-Id': context.auth.clientId,
            'X-Client-Secret': context.auth.clientSecret
        };

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
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'name': {
                            'type': 'string',
                            'required': true
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
        }
    ]
};
