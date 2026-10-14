'use strict';

const lib = require('../../lib');

const SENSITIVE_HEADERS = ['authorization', 'web-api-key', 'cookie', 'set-cookie'];

// Convert Appmixer key-value inspector rows ([{ key, value }]) into a plain object.
function kvToObject(value) {
    // The Designer's key-value field sends its rows as a JSON object string
    // ('{"Accept":"application/json"}'); a plain object and an array of
    // {key, value} rows are accepted too.
    let input = value;
    if (typeof input === 'string') {
        if (!input.trim()) return {};
        try {
            input = JSON.parse(input);
        } catch (e) {
            throw new Error('Request Headers and Query Parameters must be a JSON object of key-value pairs.');
        }
    }
    if (!input || typeof input !== 'object') return {};
    const entries = Array.isArray(input)
        ? input.filter(row => row && typeof row === 'object').map(row => [row.key, row.value])
        : Object.entries(input);
    const out = {};
    for (const [key, val] of entries) {
        if (typeof key !== 'string' || key.length === 0) continue;
        out[key] = val;
    }
    return out;
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
