'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { url, method, headers, parameters, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint Path is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        let data = null;
        if (body) {
            try {
                data = typeof body === 'object' ? body : JSON.parse(body);
            } catch (error) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        // resolveApiUrl pins the request to the Groq API origin so a mistyped or
        // variable-bound path cannot leak the account's API key to another host.
        const response = await lib.request({
            context,
            method,
            url: lib.resolveApiUrl(context, url),
            headers: lib.keyValueToObject(headers),
            params: lib.keyValueToObject(parameters),
            data
        });

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
