'use strict';

const lib = require('../../lib');

const kvToObj = (arr) => {
    if (!Array.isArray(arr)) return {};
    const out = {};
    for (const row of arr) {
        if (row && typeof row.key === 'string' && row.key.length) {
            out[row.key] = row.value;
        }
    }
    return out;
};

module.exports = {

    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        let data;
        if (body) {
            try {
                data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const params = kvToObj(parametersKV);
        const response = await lib.apiCall(context, {
            method,
            url,
            headers: kvToObj(headersKV),
            params: Object.keys(params).length ? params : undefined,
            data
        });

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
