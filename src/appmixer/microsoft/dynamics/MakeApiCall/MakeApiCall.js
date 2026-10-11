'use strict';

function kvToObj(arr) {
    // The Designer's key-value field sends its rows as a JSON object string
    // ('{"Accept":"application/json"}'); a plain object and an array of
    // {key, value} rows are accepted too.
    let input = arr;
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

        const extraHeaders = kvToObj(headersKV);
        const queryParams = kvToObj(parametersKV);

        let parsedBody;
        if (body) {
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const resourceBase = context.resource || context.auth.resource || '';
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${resourceBase}${url.startsWith('/') ? url : '/' + url}`;

        const options = {
            method,
            url: targetUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${context.accessToken || context.auth?.accessToken}`,
                ...extraHeaders
            }
        };

        if (parsedBody !== undefined) {
            options.data = parsedBody;
        }

        if (Object.keys(queryParams).length > 0) {
            options.params = queryParams;
        }


        try {
            const { data, status, statusText } = await context.httpRequest(options);
            return context.sendJson({ response: data, status, statusText }, 'out');
        } catch (error) {
            // If Axios throws an error, the response is in error.response.data.
            const axiosError = error.response?.data;
            // This propagates the error properly when the component is called by a different component.
            error.message = `${error.message}: ${axiosError?.error?.message || axiosError?.message || ''}`;
            throw error;
        }
    }
};
