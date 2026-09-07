'use strict';

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

        // Jira is OAuth2 but instance-specific: the base URL is built from the cloud id.
        // Existing components use context.profileInfo.apiUrl
        // (`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/`), which is derived
        // from the cloudId resolved in auth.js (requestProfileInfo). We resolve the same
        // cloudId here to build the instance base URL.
        const profileInfo = context.profileInfo || {};
        let cloudId = profileInfo.cloudId;
        if (!cloudId && profileInfo.apiUrl) {
            const match = profileInfo.apiUrl.match(/\/ex\/jira\/([^/]+)/);
            if (match) {
                cloudId = match[1];
            }
        }
        if (!cloudId) {
            throw new context.CancelError('Could not resolve the Jira cloud id from the connected account.');
        }

        const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                ...extraHeaders
            }
        };

        let parsedBody;
        if (body) {
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
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
