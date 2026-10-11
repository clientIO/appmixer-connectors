'use strict';

const lib = require('../lib');

function kvToObj(arr) {
    // The Designer's key-value field sends its rows as a JSON object string
    // ('{"Accept":"application/json"}'); a plain object and an array of
    // {key, value} rows are accepted too.
    let input = arr;
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

        const baseUrl = lib.getBaseUrl(context.auth, context);
        const isAbsolute = /^https?:\/\//i.test(url);
        const targetUrl = isAbsolute
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

        // The account's API key is attached below, so the target must stay on the
        // configured Deepgram (or custom/self-hosted) origin. Without this check a flow
        // could point the URL at any host and leak the key, or use this component as an
        // authenticated SSRF primitive against internal services.
        if (isAbsolute) {
            let requested;
            try {
                requested = new URL(url);
            } catch (e) {
                throw new context.CancelError(`API Endpoint URL is not a valid URL: ${url}`);
            }
            const allowed = new URL(baseUrl);
            if (requested.origin !== allowed.origin) {
                throw new context.CancelError(
                    `API Endpoint URL must stay on the configured Deepgram host ${allowed.origin}, `
                    + `but it points at ${requested.origin}. Use a path such as /v1/projects, `
                    + 'or change the Region / Custom Host on the connected account.'
                );
            }
        }

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...lib.getAuthHeaders(context.auth),
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
