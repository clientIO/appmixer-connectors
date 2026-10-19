'use strict';

const { getHeaders, resolveApiUrl, keyValueToObject } = require('../../lib');

/**
 * Call any LinkedIn API endpoint with the connected account.
 * Requests are restricted to https://api.linkedin.com.
 */
module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const requestOptions = {
            method,
            url: resolveApiUrl(context, url),
            headers: {
                ...getHeaders(context),
                'Content-Type': 'application/json',
                ...keyValueToObject(context, headers, 'Request Headers')
            }
        };

        const params = keyValueToObject(context, parameters, 'Query Parameters');
        if (Object.keys(params).length > 0) {
            requestOptions.params = params;
        }

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (err) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
