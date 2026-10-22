'use strict';
const { resolveApiDomain } = require('../../endpoints');

function kvToObj(value) {
    // The Designer's key-value field sends its rows as a JSON object string
    // ('{"Accept":"application/json"}'); a plain object and an array of
    // {key, value} rows are accepted too.
    let input = value;
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

        // Resolve the data-center-specific API host of the account, the
        // same way ZohoClient does. Accept either an absolute URL (used as-is) or
        // a path relative to the Books API (https://www.zohoapis.<tld>/books/v3).
        const isAbsolute = /^https?:\/\//i.test(url);
        let targetUrl;
        if (isAbsolute) {
            targetUrl = url;
        } else {
            const path = url.startsWith('/') ? url : '/' + url;
            const endpoint = path.startsWith('/books/') ? path : `/books/v3${path}`;
            targetUrl = `${resolveApiDomain(context.profileInfo)}${endpoint}`;
        }

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                'Authorization': `Zoho-oauthtoken ${context.auth.accessToken}`,
                'User-Agent': 'AppMixer',
                ...extraHeaders
            }
        };

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
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
