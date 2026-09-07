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

        const baseUrl = 'https://api.xero.com';
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

        // Xero requires a tenant id. Allow the caller to supply it via the
        // Xero-tenant-id header; otherwise resolve the first available tenant.
        let tenantId = extraHeaders['Xero-tenant-id'] || extraHeaders['xero-tenant-id'];
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
                'Xero-tenant-id': tenantId,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
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
