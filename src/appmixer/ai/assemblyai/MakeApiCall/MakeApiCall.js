'use strict';

const lib = require('../lib');

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

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const extraHeaders = kvToObj(headersKV);
        const queryParams = kvToObj(parametersKV);

        // The request carries the account's API key, so an absolute URL is only accepted
        // when it points at the account's own regional API host.
        const baseUrl = lib.getBaseUrl(context);
        let targetUrl;

        if (/^https?:\/\//i.test(url)) {
            let parsed;
            try {
                parsed = new URL(url);
            } catch (e) {
                throw new context.CancelError('API Endpoint URL is not a valid URL.');
            }
            if (parsed.origin !== new URL(baseUrl).origin) {
                throw new context.CancelError(
                    `API Endpoint URL must target ${baseUrl}. Use a path such as /v2/transcript instead.`
                );
            }
            targetUrl = parsed.href;
        } else {
            targetUrl = `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
        }

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...lib.getHeaders(context),
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        if (body) {
            let parsedBody;
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            requestOptions.data = parsedBody;
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
