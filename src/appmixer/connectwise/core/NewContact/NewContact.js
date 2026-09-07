'use strict';

const dependencies = {
    'json-pointer': require('json-pointer'),
    'jsonata': require('jsonata')
};

module.exports = {

    receive: async function(context) {

        if (context.messages.webhook) {
            await context.log({
                step: 'webhook',
                webhook: context.messages.webhook
            });

            let out = this.replaceRuntimeExpressions('$request.body', context, {}, context.messages.webhook
                .content);
            const expCondition = dependencies.jsonata("$boolean(Action='added')");
            const condition = await expCondition.evaluate(out);
            if (!condition) return null;
            const expOutput = dependencies.jsonata('$eval(Entity)');
            out = await expOutput.evaluate(out);
            await context.sendJson(out, 'out');
            return context.response(out);
        }
    },

    test: async function(context) {

        // Honor the subscription scope (properties.level/objectId) so Test Mode emits an
        // example the configured trigger would actually deliver. All paths fetch through the
        // same REST client/base URL the webhook lifecycle uses; the resource matches the
        // schema of the webhook Entity.
        const { level, objectId } = context.properties;
        const baseUrl = this.getBaseUrl(context) + '/company/contacts';

        // level=Owner subscribes to every contact — the newest one is representative.
        if (level === 'Owner') {
            const response = await this.httpRequest(context, {
                url: baseUrl,
                method: 'GET',
                query: { orderBy: 'id desc', pageSize: 1 }
            });
            const record = (response.data || [])[0];
            if (!record) {
                throw new context.CancelError('No contacts found to use as test data.');
            }
            return context.sendJson(record, 'out');
        }

        // level=Contact subscribes to one specific contact — fetch exactly that record.
        if (level === 'Contact') {
            const response = await this.httpRequest(context, {
                url: `${baseUrl}/${objectId}`,
                method: 'GET'
            });
            if (!response.data) {
                throw new context.CancelError(`Contact ${objectId} not found to use as test data.`);
            }
            return context.sendJson(response.data, 'out');
        }

        // Type/Territory/Company narrow delivery to a subset that cannot be reproduced
        // faithfully with a read-only fetch — throw rather than emit an out-of-scope sample.
        throw new context.CancelError(
            `Flow Test Mode cannot sample a "${level}"-scoped subscription read-only. Use level "Owner" or "Contact", or trigger it with a real event.`
        );
    },

    httpRequest: async function(context, override = {}) {

        let url = null;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {};

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

        req.headers.Authorization =
            `Basic ${btoa(context.auth.companyId + '+' + context.auth.publicKey + ':' + context.auth.privateKey)}`;
        req.headers.ClientId = context.auth.clientId;

        await context.log({
            step: 'request',
            req
        });

        const response = await context.httpRequest(req);

        await context.log({
            step: 'response',
            url,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });

        return response;
    },

    getBaseUrl: function(context) {

        return (context.auth.environment === 'staging') ?
            'https://api-staging.connectwisedev.com/v4_6_release/apis/3.0/' :
            `https://api-${context.auth.environment}.myconnectwise.net/v4_6_release/apis/3.0/`;
    },

    start: async function(context) {

        const override = {};
        override.url = this.replaceRuntimeExpressions('{$baseUrl}/system/callbacks', context, {});
        override.method = 'POST';
        override.body = this.replaceRuntimeExpressions({
            'url': '{$webhookUrl}',
            'objectId': '{$parameters.objectId}',
            'type': 'Contact',
            'level': '{$parameters.level}'
        }, context, {});
        const response = await this.httpRequest(context, override);
        return context.stateSet('response', {
            data: response.data,
            headers: response.headers
        });
    },

    stop: async function(context) {

        const response = await context.stateGet('response');

        const override = {};
        override.url = this.replaceRuntimeExpressions('{$baseUrl}/system/callbacks/{$response.body#/id}',
            context, response);
        override.method = 'DELETE';

        return this.httpRequest(context, override);
    },

    replaceRuntimeExpressions: function(template, context, response, request) {

        if (template === '$request.body') {
            return request.data;
        }

        let result = JSON.stringify(template);

        result = result.replace(/{\$response.body#([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(response.data, pointer);
        });

        result = result.replace(/{\$response.header\.([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(response.headers, '/' + pointer);
        });

        result = result.replace(/{\$webhookUrl}/g, context.getWebhookUrl());

        result = result.replace(/{\$baseUrl}/g, this.getBaseUrl(context));

        result = result.replace(/{\$parameters\.([^}]*)}/g, (match, pointer) => {
            return dependencies['json-pointer'].get(context.properties, '/' + pointer);
        });

        return JSON.parse(result);
    }

};
