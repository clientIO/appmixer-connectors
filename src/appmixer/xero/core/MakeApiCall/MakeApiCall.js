'use strict';

/**
 * Key-value inspector input -> plain object.
 * The Designer's key-value field stores its rows as a JSON string of an object
 * ('{"xero-tenant-id":"…"}'). A plain object and an array of {key, value} rows
 * (the shape this helper used to expect) are accepted too, for values mapped
 * from a variable or set through the API.
 * @param {string|Object|Array} value
 * @param {string} label Field label for the error message
 * @param {Object} context
 * @returns {Object}
 */
function kvToObj(value, label, context) {

    let input = value;
    if (typeof input === 'string') {
        if (!input.trim()) return {};
        try {
            input = JSON.parse(input);
        } catch (e) {
            throw new context.CancelError(`${label} must be a JSON object of key-value pairs.`);
        }
    }
    if (!input || typeof input !== 'object') return {};

    const rows = Array.isArray(input)
        ? input.filter(row => row && typeof row === 'object').map(row => [row.key, row.value])
        : Object.entries(input);

    const out = {};
    for (const [key, val] of rows) {
        if (typeof key !== 'string' || key.length === 0) continue;
        out[key] = val;
    }
    return out;
}

module.exports = {
    async receive(context) {

        const {
            tenantId: tenantInput,
            url,
            method,
            headers: headersKV,
            parameters: parametersKV,
            body
        } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const extraHeaders = kvToObj(headersKV, 'Request Headers', context);
        const queryParams = kvToObj(parametersKV, 'Query Parameters', context);

        const baseUrl = 'https://api.xero.com';
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

        // Xero requires a tenant (organisation) id. The Tenant input wins, then a
        // xero-tenant-id request header (any letter case); a connection to a single
        // organisation can leave both empty and its only tenant is used.
        const tenantHeaderKeys = Object.keys(extraHeaders).filter(key => key.toLowerCase() === 'xero-tenant-id');
        const tenantHeader = tenantHeaderKeys.map(key => extraHeaders[key]).find(value => value);
        tenantHeaderKeys.forEach(key => delete extraHeaders[key]);

        let tenantId = tenantInput || tenantHeader;
        if (!tenantId) {
            const tenants = await context.httpRequest({
                url: 'https://api.xero.com/connections',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            tenantId = tenants.data && tenants.data[0] && tenants.data[0].tenantId;
            if (!tenantId) {
                throw new context.CancelError('No Xero tenant found for this connection.');
            }
        }

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders,
                'Xero-tenant-id': tenantId
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
            requestOptions.params = { ...requestOptions.params, ...queryParams };
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
