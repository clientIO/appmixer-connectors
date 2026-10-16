'use strict';
const { normalizeStore } = require('../../lib');
const { API_VERSION } = require('../../graphql-client');

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

// The access token goes with every request, so the request may only leave for
// the connected store's Admin API. A relative path is resolved against the
// supported API version; a full URL is accepted only on the store's own origin.
function resolveApiUrl(context, url) {

    let origin;
    try {
        origin = `https://${normalizeStore(context.auth.store)}.myshopify.com`;
    } catch (error) {
        throw new context.CancelError(error.message);
    }

    const path = String(url).trim();
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')
        ? path
        : `/admin/api/${API_VERSION}${path.startsWith('/') ? '' : '/'}${path}`;

    let parsed;
    try {
        parsed = new URL(candidate, origin);
    } catch (error) {
        throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
    }
    if (parsed.username || parsed.password) {
        throw new context.CancelError('API Endpoint Path must not contain credentials.');
    }
    if (parsed.origin !== origin) {
        throw new context.CancelError(`API Endpoint Path must target ${origin}, got ${parsed.origin}.`);
    }
    return parsed.toString();
}

module.exports = {

    resolveApiUrl,

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

        const targetUrl = resolveApiUrl(context, url);

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                'X-Shopify-Access-Token': context.auth.accessToken,
                'Content-Type': 'application/json',
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

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
