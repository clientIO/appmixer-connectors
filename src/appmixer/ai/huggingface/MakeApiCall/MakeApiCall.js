'use strict';

const lib = require('../lib');

// Convert Appmixer key-value inspector rows into a plain object.
function kvToObject(rows) {
    if (!Array.isArray(rows)) {
        return {};
    }
    const result = {};
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) {
            continue;
        }
        result[row.key] = row.value;
    }
    return result;
}

module.exports = {

    async receive(context) {

        const { api, url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const baseUrl = api === 'router' ? lib.ROUTER_BASE_URL : lib.HUB_API_BASE_URL;

        // The access token is attached to every request below, so the target has to
        // be pinned to a Hugging Face host. Without this an absolute URL pointing at
        // a third-party host would leak the account's secret to that host.
        const targetUrl = lib.resolveApiUrl(context, url, baseUrl);

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...kvToObject(lib.parseJson(context, headers, 'Request Headers') || headers),
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        const params = kvToObject(lib.parseJson(context, parameters, 'Query Parameters') || parameters);
        if (Object.keys(params).length > 0) {
            requestOptions.params = params;
        }

        if (body) {
            requestOptions.data = lib.parseJson(context, body, 'Request Body');
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            statusCode: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
