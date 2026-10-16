'use strict';

// Key-value inputs arrive as a JSON string (their schema type is string), or as an array.
function kvToObj(context, value, label) {
    let arr = value;
    if (typeof arr === 'string') {
        if (!arr.trim()) return {};
        try {
            arr = JSON.parse(arr);
        } catch (e) {
            throw new context.CancelError(`${label} must be a JSON array of {"key", "value"} items.`);
        }
    }
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

        const extraHeaders = kvToObj(context, headersKV, 'Headers');
        const queryParams = kvToObj(context, parametersKV, 'Query Parameters');

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const baseUrl = `https://${context.auth.instance}.service-now.com`;
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url}`;

        const authHeaders = context.auth.apiKey
            ? { 'x-sn-apikey': context.auth.apiKey }
            : { 'Authorization': 'Basic ' + Buffer.from(`${context.auth.username}:${context.auth.password}`).toString('base64') };

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...authHeaders,
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
