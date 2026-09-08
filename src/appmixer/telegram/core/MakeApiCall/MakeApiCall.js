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

        const token = lib.getBotToken(context.auth);

        if (!token) {
            throw new context.CancelError('Bot Token is required!');
        }

        const isAbsolute = /^https?:\/\//i.test(url);

        // The bot token is attached below and grants full control of the bot, so the target
        // must stay on Telegram. Without this check a flow could point the URL at any host
        // and leak the token, or use this component as an authenticated SSRF primitive.
        if (isAbsolute) {
            let requested;

            try {
                requested = new URL(url);
            } catch (error) {
                throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
            }

            if (requested.origin !== lib.API_BASE_URL) {
                throw new context.CancelError(
                    `API Endpoint Path must stay on ${lib.API_BASE_URL}, but it points at ${requested.origin}. `
                    + 'Use a Bot API method such as /sendMessage instead.'
                );
            }
        }

        const path = url.startsWith('/') ? url : `/${url}`;
        let target = isAbsolute ? url : `${lib.API_BASE_URL}/bot${token}${path}`;

        const query = new URLSearchParams();

        for (const [key, value] of Object.entries(kvToObj(parametersKV))) {
            if (value !== undefined && value !== null && value !== '') {
                query.append(key, value);
            }
        }

        if (query.toString()) {
            target += `${target.includes('?') ? '&' : '?'}${query.toString()}`;
        }

        let data;

        if (body) {
            try {
                data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (error) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        let response;

        try {
            response = await context.httpRequest({
                method,
                url: target,
                headers: { 'Content-Type': 'application/json', ...kvToObj(headersKV) },
                data
            });
        } catch (error) {
            throw lib.normalizeError(context, error, path);
        }

        if (response.data && response.data.ok === false) {
            throw lib.normalizeError(context, { response }, path);
        }

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
