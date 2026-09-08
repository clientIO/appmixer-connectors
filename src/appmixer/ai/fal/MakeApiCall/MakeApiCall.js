'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { baseUrl, url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        let targetUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            targetUrl = url;
        } else {
            const origin = lib.BASE_URLS[baseUrl] || lib.PLATFORM_URL;
            targetUrl = `${origin}${url.startsWith('/') ? url : `/${url}`}`;
        }

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                ...lib.kvToObject(headers),
                ...lib.authHeaders(context)
            }
        };

        const params = lib.kvToObject(parameters);
        if (Object.keys(params).length > 0) {
            requestOptions.params = params;
        }

        if (body) {
            try {
                requestOptions.data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (error) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            requestOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await lib.request(context, requestOptions);

        return context.sendJson({
            statusCode: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
