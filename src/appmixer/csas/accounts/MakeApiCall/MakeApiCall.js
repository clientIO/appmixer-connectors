'use strict';

const lib = require('../../lib');

const SENSITIVE_HEADERS = ['authorization', 'web-api-key', 'cookie', 'set-cookie'];

// Convert Appmixer key-value inspector rows ([{ key, value }]) into a plain object.
function kvToObject(rows) {
    if (rows && typeof rows === 'object' && !Array.isArray(rows)) {
        return rows;
    }
    if (!Array.isArray(rows)) {
        return {};
    }
    const result = {};
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) {
            continue;
        }
        result[row.key] = row.value;
    }
    return result;
}

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
            url: lib.resolveApiUrl(context, url),
            headers: {
                ...kvToObject(headers),
                ...lib.getHeaders(context)
            }
        };

        const params = kvToObject(parameters);
        if (Object.keys(params).length > 0) {
            requestOptions.params = params;
        }

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await context.httpRequest(requestOptions);

        // The CSAS gateway echoes request headers back in the response, including the
        // bearer token and the API key — keep them out of the flow data and logs.
        const responseHeaders = Object.fromEntries(Object.entries(response.headers || {})
            .filter(([name]) => !SENSITIVE_HEADERS.includes(name.toLowerCase())));

        return context.sendJson({
            statusCode: response.status,
            headers: responseHeaders,
            body: response.data
        }, 'out');
    }
};
