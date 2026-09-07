'use strict';

const lib = require('../../lib');

function kvToObject(rows, blockedHeaders = []) {

    if (!Array.isArray(rows)) return {};
    const blocked = new Set(blockedHeaders.map((value) => value.toLowerCase()));
    const result = {};

    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) continue;
        if (blocked.has(row.key.toLowerCase())) continue;
        result[row.key] = row.value;
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
