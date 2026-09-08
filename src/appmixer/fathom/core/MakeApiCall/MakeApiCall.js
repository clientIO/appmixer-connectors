'use strict';

const lib = require('../../lib');

function kvToObj(arr) {
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

        const baseUrl = lib.API_BASE_URL;
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

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

        const response = await lib.apiRequest(context, requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
