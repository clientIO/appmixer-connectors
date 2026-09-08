'use strict';

const lib = require('../../lib');

/**
 * Flatten a key-value inspector list into a plain object.
 * @param {Array} rows
 * @returns {object}
 */
function kvToObj(rows) {

    if (!Array.isArray(rows)) {
        return {};
    }

    const result = {};

    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const key = row.key;
        if (typeof key !== 'string' || key.length === 0) continue;
        result[key] = row.value;
    }

    return result;
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

        const baseUrl = lib.getBaseUrl(context.auth);
        const isAbsolute = /^https?:\/\//i.test(url);

        // The account's API key is attached below, so the target must stay on the shard
        // the key belongs to. Without this check a flow could point the URL at any host
        // and leak the key, or use this component as an authenticated SSRF primitive.
        if (isAbsolute) {
            let requested;

            try {
                requested = new URL(url);
            } catch (error) {
                throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
            }

            const allowed = new URL(baseUrl);

            if (requested.origin !== allowed.origin) {
                throw new context.CancelError(
                    `API Endpoint Path must stay on your Cliniko shard ${allowed.origin}, `
                    + `but it points at ${requested.origin}. Use a path such as /patients instead.`
                );
            }
        }

        const queryParams = kvToObj(parametersKV);
        const path = isAbsolute ? null : (url.startsWith('/') ? url : `/${url}`);
        let target = isAbsolute ? url : `${baseUrl}${path}`;

        const query = lib.buildQuery({ params: queryParams });
        if (query) {
            target += `${target.includes('?') ? '&' : '?'}${query}`;
        }

        let data;

        if (body) {
            try {
                data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (error) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const response = await lib.apiRequest(context, {
            method,
            url: target,
            headers: { 'Content-Type': 'application/json', ...kvToObj(headersKV) },
            data
        });

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
