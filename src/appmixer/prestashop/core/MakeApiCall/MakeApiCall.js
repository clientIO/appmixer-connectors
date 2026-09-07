'use strict';

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

        const shopUrl = (context.auth.shopUrl || '').replace(/\/+$/, '');
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${shopUrl}/api${url.startsWith('/') ? '' : '/'}${url}`;

        const credentials = Buffer.from(`${context.auth.apiKey}:`).toString('base64');

        const requestOptions = {
            method,
            url: targetUrl,
            params: { output_format: 'JSON', ...queryParams },
            headers: {
                'Authorization': `Basic ${credentials}`,
                ...extraHeaders
            }
        };

        if (body) {
            requestOptions.data = body;
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
