'use strict';

module.exports = {

    receive: async function(context) {
        const { content } = context.messages.in;

        let requestBody;

        if (content.model === 'gpt-3.5-turbo-instruct') {
            requestBody = content;
        } else {
            delete content.suffix;
            requestBody = content;
        }

        const req = {
            url: 'https://api.openai.com/v1/completions',
            method: 'POST',
            data: requestBody,
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        try {
            const response = await context.httpRequest(req);

            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return context.sendJson(response.data, 'out');

        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    }
};
