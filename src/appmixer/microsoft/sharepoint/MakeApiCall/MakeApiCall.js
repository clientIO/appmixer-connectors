'use strict';

const GRAPH_ORIGIN = 'https://graph.microsoft.com';
const GRAPH_BASE_URL = `${GRAPH_ORIGIN}/v1.0/`;

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

/**
 * Resolve the API Endpoint URL input to an absolute Microsoft Graph URL.
 *
 * A path is taken relative to https://graph.microsoft.com/v1.0/ whether or not it starts with a
 * slash; a path that already names the API version (`/v1.0/...`, `/beta/...`) is kept as is. A
 * full URL is accepted only on the Graph origin: the account's access token is attached to the
 * request, so it must never be sent to any other host.
 * @param {Context} context
 * @param {string} url
 * @return {string}
 */
function resolveGraphUrl(context, url) {

    const value = String(url).trim();
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//');

    let candidate = value;
    if (!isAbsolute) {
        const path = value.replace(/^\/+/, '');
        candidate = /^(v1\.0|beta)(\/|$)/.test(path) ? `${GRAPH_ORIGIN}/${path}` : `${GRAPH_BASE_URL}${path}`;
    }

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (err) {
        throw new context.CancelError(`API Endpoint URL is not a valid URL: ${url}`);
    }

    if (parsed.username || parsed.password) {
        throw new context.CancelError('API Endpoint URL must not contain credentials.');
    }
    if (parsed.origin !== GRAPH_ORIGIN) {
        throw new context.CancelError(`API Endpoint URL must target ${GRAPH_ORIGIN}, got ${parsed.origin}.`);
    }

    return parsed.toString();
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

        const request = {
            method,
            url: resolveGraphUrl(context, url),
            headers: {
                'Content-Type': 'application/json',
                ...kvToObj(headersKV),
                // Last, so that a header row can never replace the account's credential.
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        };

        if (body) {
            try {
                request.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const queryParams = kvToObj(parametersKV);
        if (Object.keys(queryParams).length > 0) {
            request.params = queryParams;
        }

        const response = await context.httpRequest(request);
        return context.sendJson({ response: response.data }, 'out');
    },

    resolveGraphUrl
};
