'use strict';

const lib = require('../lib');

function kvToObj(arr) {
    // The engine can deliver the key-value input as a JSON string (e.g. when the array
    // comes from a flow transform instead of the designer's key-value editor).
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        } catch (e) {
            return {};
        }
    }
    if (!arr || !Array.isArray(arr)) return {};
    const out = {};
    for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        const key = row.key;
        if (typeof key !== 'string' || key.length === 0) continue;
        out[key] = row.value;
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
