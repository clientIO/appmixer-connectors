'use strict';

const lib = require('../../lib');

function kvToObject(rows, blockedHeaders = []) {
    // The Designer's key-value field sends its rows as a JSON object string
    // ('{"Accept":"application/json"}'); a plain object and an array of
    // {key, value} rows are accepted too.
    let input = rows;
    if (typeof input === 'string') {
        if (!input.trim()) return {};
        try {
            input = JSON.parse(input);
        } catch (e) {
            throw new Error('Request Headers and Query Parameters must be a JSON object of key-value pairs.');
        }
    }
    if (!input || typeof input !== 'object') return {};
    const blocked = new Set(blockedHeaders.map((value) => value.toLowerCase()));
    const entries = Array.isArray(input)
        ? input.filter(row => row && typeof row === 'object').map(row => [row.key, row.value])
        : Object.entries(input);
    const result = {};
    for (const [key, val] of entries) {
        if (typeof key !== 'string' || key.length === 0) continue;
        if (blocked.has(key.toLowerCase())) continue;
        result[key] = val;
    }
    return result;
}

module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content;
        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const request = {
            method,
            url: lib.apiUrl(url, context),
            headers: {
                ...kvToObject(headers, ['authorization', 'host', 'content-length']),
                ...lib.authHeaders(context)
            }
        };

        const query = kvToObject(parameters);
        if (Object.keys(query).length > 0) {
            request.params = query;
        }

        if (body) {
            try {
                request.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (error) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            request.headers['Content-Type'] = 'application/json';
        }

        const response = await context.httpRequest(request);
        const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
        if (!contentType.includes('json')) {
            throw new context.CancelError('This component supports JSON responses only. Use Render Page for PNG, JPEG, or PDF artifacts.');
        }

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
