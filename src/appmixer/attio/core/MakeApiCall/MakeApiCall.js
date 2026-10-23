'use strict';

const lib = require('../../lib');

function kvToObj(value) {
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

/**
 * The request path on api.attio.com. Full URLs are accepted only on that origin so the
 * workspace token is never sent anywhere else.
 */
function toPath(context, url) {
    if (/^https?:\/\//i.test(url)) {
        const parsed = new URL(url);
        if (parsed.origin !== lib.API_BASE_URL) {
            throw new context.CancelError('Only URLs on ' + lib.API_BASE_URL + ' are allowed.');
        }
        return parsed.pathname + parsed.search;
    }
    return url.startsWith('/') ? url : '/' + url;
}

module.exports = {

    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const requestOptions = {
            method,
            url: lib.API_BASE_URL + toPath(context, url),
            headers: {
                ...kvToObj(headersKV),
                Authorization: 'Bearer ' + context.auth.apiKey
            }
        };

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const queryParams = kvToObj(parametersKV);
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
