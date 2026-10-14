'use strict';

function kvToObj(input) {

    let rows = input;
    if (typeof rows === 'string' && rows.trim()) {
        try {
            rows = JSON.parse(rows);
        } catch (e) {
            return {};
        }
    }
    if (!Array.isArray(rows)) {
        return {};
    }
    const out = {};
    for (const row of rows) {
        if (row && typeof row === 'object' && typeof row.key === 'string' && row.key) {
            out[row.key] = row.value;
        }
    }
    return out;
}

/**
 * Resolve the endpoint against the account's own Teamwork site (installation.apiEndPoint
 * stored at auth time). A full URL is accepted only when it targets that same origin,
 * so the account's bearer token is never sent anywhere else.
 */
function resolveApiUrl(context, url) {

    const base = context.auth.profileInfo.accountURL;
    let baseOrigin;
    try {
        baseOrigin = new URL(base).origin;
    } catch (e) {
        throw new context.CancelError('The connected account has no Teamwork site URL. Reconnect the account.');
    }

    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
        ? url
        : `${url.startsWith('/') ? '' : '/'}${url}`;

    let parsed;
    try {
        parsed = new URL(candidate, baseOrigin);
    } catch (e) {
        throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
    }
    if (parsed.username || parsed.password) {
        throw new context.CancelError('API Endpoint Path must not contain credentials.');
    }
    if (parsed.origin !== baseOrigin) {
        throw new context.CancelError(`API Endpoint Path must target ${baseOrigin}, got ${parsed.origin}.`);
    }
    return parsed.toString();
}

module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        // Drop any user-supplied Authorization header (any case) so the call always uses the connected account.
        const extraHeaders = Object.fromEntries(
            Object.entries(kvToObj(headers)).filter(([name]) => name.toLowerCase() !== 'authorization')
        );

        const request = {
            method,
            url: resolveApiUrl(context, url),
            headers: {
                'X-Teamwork-Product': 'appmixer',
                'Content-Type': 'application/json',
                ...extraHeaders,
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        };

        const query = kvToObj(parameters);
        if (Object.keys(query).length) {
            request.params = query;
        }

        if (body && method !== 'GET') {
            try {
                request.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const response = await context.httpRequest(request);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
