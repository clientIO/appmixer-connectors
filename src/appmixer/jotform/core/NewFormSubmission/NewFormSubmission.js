'use strict';

const dependencies = {
    'json-pointer': require('json-pointer'),
    'jsonata': require('jsonata')
};

module.exports = {

    receive: async function (context) {

        if (context.messages.webhook) {
            await context.log({
                step: 'webhook',
                webhook: context.messages.webhook
            });

            let out = await this.replaceRuntimeExpressions('$request.body', context, {}, context.messages
                .webhook.content);
            // const expCondition = dependencies.jsonata('$exists(submissionID)');
            // context.log({ step: 'expCondition', expCondition });
            // context.log({ step: 'expCondition out', out });
            // context.log({ step: 'parameters: context.properties', contextProperties: context.properties });
            // const condition = await expCondition.evaluate(out, {
            //     parameters: context.properties
            // });
            // if (!condition) return null;
            await context.sendJson(out, 'out');
            return context.response(out);
        }
    },

    httpRequest: async function (context, override = {}) {

        let url = null;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {};

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
            method: 'POST',
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

    getBaseUrl: function (context) {

        let url = 'https://{regionPrefix}.jotform.com';
        url = url.replaceAll('{regionPrefix}', context.auth.regionPrefix || 'api');
        return url;
    },

    start: async function (context) {

        const override = {};
        override.url = await this.replaceRuntimeExpressions('{$baseUrl}/form/{$parameters.formId}/webhooks',
            context, {});
        override.method = 'POST';
        override.headers = await this.replaceRuntimeExpressions({
            'Content-Type': 'application/x-www-form-urlencoded'
        }, context, {});
        override.body = await this.replaceRuntimeExpressions({
            'webhookURL': '{$webhookUrl}'
        }, context, {});
        const response = await this.httpRequest(context, override);
        return context.stateSet('response', {
            data: response.data,
            headers: response.headers
        });
    },

    stop: async function (context) {

        const response = await context.stateGet('response');

        const override = {};
        override.url = await this.replaceRuntimeExpressions(
            // eslint-disable-next-line max-len
            '{$baseUrl}/form/{$parameters.formId}/webhooks/{$response.transform#$keys(data.content) ~> $filter(function ($key) { $lookup(data.content, $key) = "{$webhookUrl}"})}',
            context, response);
        override.method = 'DELETE';

        return this.httpRequest(context, override);
    },

    replaceRuntimeExpressions: async function (template, context, response, request) {

        if (template === '$request.body') {
            return request.data;
        }

        let result = typeof template === 'string' ? template : JSON.stringify(template);

        result = result.replace(/{\$webhookUrl}/g, context.getWebhookUrl());
        result = result.replace(/{\$baseUrl}/g, this.getBaseUrl(context));

        result = result.replace(/{\$response.body#([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(response.data, pointer);
        });

        result = result.replace(/{\$parameters\.([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(context.properties, '/' + pointer);
        });

        const responseTransformPromises = [];
        const responseTransformRegex = /{\$response.transform#(.*(?<!\\))}/g;
        result.replace(responseTransformRegex, (match, exp) => {
            const expression = dependencies['jsonata'](exp);
            responseTransformPromises.push(expression.evaluate(response));
        });
        const replacements = await Promise.all(responseTransformPromises);
        result = result.replace(responseTransformRegex, () => replacements.shift());

        result = result.replace(/{\$response.header\.([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(response.headers, '/' + pointer);
        });

        return typeof template === 'string' ? result : JSON.parse(result);
    }

};
