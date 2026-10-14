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

module.exports = {

    async receive(context) {

        const { method, url, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }
        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const extraHeaders = kvToObj(headersKV);
        const queryParams = kvToObj(parametersKV);

        const baseUrl = lib.baseUrl(context);
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

        const requestOptions = {
            method,
            url: targetUrl,
            params: {
                clientKey: context.auth.clientKey,
                ...queryParams
            },
            headers: {
                Authorization: `Bearer ${context.auth.token}`,
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        if (body) {
            let parsedBody;
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (err) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            requestOptions.data = parsedBody;
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
