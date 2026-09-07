'use strict';

const { generateAuthorizationHeader } = require('../../lib');

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

module.exports = {
    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const extraHeaders = kvToObj(headersKV);
        const queryParams = kvToObj(parametersKV);

        let { hostnameUrl } = context.auth;
        const { accessToken, clientToken, clientSecret } = context.auth;

        if (hostnameUrl.includes('http://')) {
            hostnameUrl = hostnameUrl.replace(/^http?:\/\//, '');
        } else if (hostnameUrl.includes('https://')) {
            hostnameUrl = hostnameUrl.replace(/^https?:\/\//, '');
        }
        hostnameUrl = hostnameUrl.replace(/\/$/, '');

        // Determine the request path relative to the Akamai host.
        let requestPath;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const parsed = new URL(url);
            requestPath = `${parsed.pathname}${parsed.search}`;
        } else {
            requestPath = url.startsWith('/') ? url : '/' + url;
        }

        let parsedBody;
        if (body) {
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const {
            url: signedUrl,
            method: signedMethod,
            headers: { Authorization }
        } = generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method,
            path: requestPath,
            body: parsedBody ? JSON.stringify(parsedBody) : undefined
        });

        const requestOptions = {
            method: signedMethod,
            url: signedUrl,
            headers: {
                'Authorization': Authorization,
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        if (parsedBody !== undefined) {
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
