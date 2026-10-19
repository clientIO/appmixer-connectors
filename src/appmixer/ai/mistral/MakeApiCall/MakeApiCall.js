'use strict';

const lib = require('../lib');

// The key-value inspector stores its rows as a JSON string of an object
// (`{"limit":"1"}`). A whole-field variable bound to an array output, or a
// hand-written flow, can instead carry the `[{ key, value }]` row form - accept
// both, as a string or already parsed, and refuse malformed JSON rather than
// silently sending the request without the user's headers or parameters.
const kvToObject = (context, rows, label) => {

    if (typeof rows === 'string') {
        if (!rows.trim()) {
            return {};
        }
        try {
            rows = JSON.parse(rows);
        } catch (err) {
            throw new context.CancelError(`${label} must be a JSON object of key-value pairs.`);
        }
    }

    if (rows && typeof rows === 'object' && !Array.isArray(rows)) {
        return { ...rows };
    }

    if (!Array.isArray(rows)) {
        return {};
    }

    const out = {};
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) continue;
        out[row.key] = row.value;
    }
    return out;
};

module.exports = {

    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        // Validate required inputs
        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const extraHeaders = kvToObject(context, headersKV, 'Headers');
        const queryParams = kvToObject(context, parametersKV, 'Query Parameters');

        // The account's API key is attached to every request, so the target is pinned
        // to the Mistral API host - an absolute URL elsewhere would leak the key.
        const targetUrl = lib.resolveApiUrl(context, url);

        const requestOptions = {
            method,
            url: targetUrl,
            headers: lib.requestHeaders(context, extraHeaders)
        };

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (err) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        if (Object.keys(queryParams).length > 0) {
            requestOptions.params = queryParams;
        }

        // https://docs.mistral.ai/api/
        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
