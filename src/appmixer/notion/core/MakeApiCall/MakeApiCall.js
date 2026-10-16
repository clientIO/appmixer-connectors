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


const lib = require('../../lib');
const { API_VERSION } = lib;

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

        // The account's token goes out with this request — only ever to the Notion API.
        const targetUrl = lib.resolveApiUrl(context, url);

        const requestOptions = {
            method: method,
            url: targetUrl,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                'Notion-Version': API_VERSION, //api version from lib.js
                ...extraHeaders
            }
        };

        let parsedBody;
        if (body) {
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

        await context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
