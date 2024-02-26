'use strict';

const lib = require('../../lib');

module.exports = {

    httpRequest: async function(context, override = {}) {

        let url = null;

        const headers = {};
        const query = new URLSearchParams;

        const inputMapping = {

        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        const queryParameters = {  };

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

        headers['Authorization'] = 'token {username}:{apiKey}'.replace(/{(.*?)}/g, (match, variable) => context.auth[variable]);

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
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

    start: async function(context) {

        const override = {};
        override.url = await lib.replaceRuntimeExpressions('{$baseUrl}/callnotification/callnotification/', context, {});
        override.method = 'POST';
        override.body = await lib.replaceRuntimeExpressions({ 'target_url':'{$webhookUrl}' }, context, {});
        const response = await this.httpRequest(context, override);
        return context.stateSet('response', { data: response.data, headers: response.headers });
    },

    stop: async function(context) {

        const response = await context.stateGet('response');

        const override = {};
        override.url = await lib.replaceRuntimeExpressions('{$baseUrl}/callnotification/callnotification/{$response.body#/id}/', context, response);
        override.method = 'DELETE';

        return this.httpRequest(context, override);
    },

    receive: async function(context) {

        if (context.messages.webhook) {
            await context.log({ step: 'webhook', webhook: context.messages.webhook });

            let out = await lib.replaceRuntimeExpressions('$request.body', context, {}, context.messages.webhook.content);
            const expCondition = lib.jsonata('$boolean(status=$parameters.status)');
            const condition = await expCondition.evaluate(out, { parameters: context.properties });
            if (!condition) return null;
            await context.sendJson(out, 'out');
            return context.response(out);
        }
    }

};
