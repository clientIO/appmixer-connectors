'use strict';

function kvToObj(arr) {
    // The engine can deliver the key-value input as a JSON string (e.g. when the array
    // comes from a flow transform instead of the designer's key-value editor).
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        } catch (e) {
            return {};
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
