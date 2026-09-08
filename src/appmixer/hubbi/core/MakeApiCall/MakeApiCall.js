'use strict';

const lib = require('../../lib');

function kvToObj(arr) {
    if (!arr || !Array.isArray(arr)) {
        return {};
    }
    const out = {};
    for (const row of arr) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        const key = row.key;
        if (typeof key !== 'string' || key.length === 0) {
            continue;
        }
        out[key] = row.value;
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
