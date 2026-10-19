'use strict';

const lib = require('../../lib');

function kvToObj(rows) {

    if (!Array.isArray(rows)) {
        return {};
    }
    return rows.reduce((out, row) => {
        if (row && typeof row === 'object' && typeof row.key === 'string' && row.key.length) {
            out[row.key] = row.value;
        }
        return out;
    }, {});
}

module.exports = {

    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        let parsedBody;
        if (body) {
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (err) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const requestOptions = {
            method,
            url: /^https?:\/\//.test(url)
                ? url
                : `${lib.CORE_API_BASE}${url.startsWith('/') ? '' : '/'}${url}`,
            headers: {
                Authorization: `Bearer ${context.auth.token}`,
                'Content-Type': 'application/json',
                ...kvToObj(headersKV)
            },
            timeout: lib.getRequestTimeout(context)
        };

        if (parsedBody !== undefined) {
            requestOptions.data = parsedBody;
        }

        const queryParams = kvToObj(parametersKV);
        if (Object.keys(queryParams).length) {
            requestOptions.params = queryParams;
        }

        let response;
        try {
            response = await context.httpRequest(requestOptions);
        } catch (err) {
            throw lib.toEmarsysError(context, err);
        }

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
