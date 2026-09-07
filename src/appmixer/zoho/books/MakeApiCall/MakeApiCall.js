'use strict';
const { apiEndpoint } = require('../../endpoints');

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

        // Resolve the data-center-specific API host from the account region, the
        // same way ZohoClient does. Accept either an absolute URL (used as-is) or
        // a path relative to the Books API (https://www.zohoapis.<tld>/books/v3).
        const region = context.profileInfo?.region;
        const isAbsolute = /^https?:\/\//i.test(url);
        let targetUrl;
        if (isAbsolute) {
            targetUrl = url;
        } else {
            const path = url.startsWith('/') ? url : '/' + url;
            const endpoint = path.startsWith('/books/') ? path : `/books/v3${path}`;
            targetUrl = `${apiEndpoint(region)}${endpoint}`;
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
