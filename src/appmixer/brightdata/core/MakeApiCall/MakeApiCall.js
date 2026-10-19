'use strict';

const lib = require('../../lib');

// Convert Appmixer key-value inspector rows into a plain object.
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

        // The Bright Data API token is attached to every request below, so the
        // target has to be pinned to the Bright Data API. Without this an absolute
        // URL pointing at a third-party host would leak the account's secret.
        const targetUrl = lib.resolveApiUrl(context, url);

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...kvToObject(headers),
                ...lib.authHeaders(context)
            }
        };

        const params = kvToObject(parameters);
        if (Object.keys(params).length > 0) {
            requestOptions.params = params;
        }

        if (body) {
            requestOptions.data = lib.parseJsonInput(context, body, 'Request Body');
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            statusCode: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
