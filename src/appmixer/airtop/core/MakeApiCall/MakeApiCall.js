'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const extraHeaders = lib.keyValueToObject(context, headers, 'Request Headers');
        const queryParams = lib.keyValueToObject(context, parameters, 'Query Parameters');

        const targetUrl = lib.resolveApiUrl(context, url);

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...lib.authHeaders(context),
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        if (body) {
            requestOptions.data = lib.parseJsonInput(context, body, 'Request Body');
        }

        if (Object.keys(queryParams).length > 0) {
            requestOptions.params = queryParams;
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
