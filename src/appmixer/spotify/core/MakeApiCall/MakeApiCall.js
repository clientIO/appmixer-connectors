'use strict';

const lib = require('../../lib');

// Convert Appmixer key-value inspector rows into a plain object.
function kvToObject(rows) {

    if (!Array.isArray(rows)) {
        return {};
    }

    const result = {};
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) {
            continue;
        }
        result[row.key] = row.value;
    }
    return result;
}

/**
 * Parse a JSON snippet typed into a textarea input.
 * @param {object} context
 * @param {string|object} value
 * @param {string} label
 * @returns {*}
 */
function parseJsonInput(context, value, label) {

    if (value === null || value === undefined || value === '') {
        return undefined;
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        throw new context.CancelError(`${label} must be valid JSON.`);
    }
}

module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content || {};

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        // The connected account's access token is attached to every request below, so
        // the target has to be pinned to the Spotify API. Without this an absolute URL
        // pointing at a third-party host would leak the token.
        const targetUrl = lib.resolveApiUrl(context, url);

        const response = await lib.apiRequest(context, {
            method,
            url: targetUrl,
            params: kvToObject(parameters),
            data: parseJsonInput(context, body, 'Request Body'),
            headers: kvToObject(headers)
        });

        return context.sendJson({
            statusCode: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
