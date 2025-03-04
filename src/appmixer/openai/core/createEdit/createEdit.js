'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        // /edits is deprecated now, see https://platform.openai.com/docs/deprecations#edit-models-endpoint
        let url = lib.getBaseUrl(context) + '/chat/completions';

        const headers = {};

        const inputMapping = {
            'model': input['model'],
            messages: [
                {
                    role: 'system',
                    content: input['instruction'],
                    name: 'instruction'
                }, {
                    role: 'user',
                    content: input['input'],
                    name: 'input'
                }
            ],
            'n': input['n'],
            'temperature': input['temperature'],
            'top_p': input['top_p']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        headers['Authorization'] = 'Bearer {apiKey}'.replace(/{(.*?)}/g, (match, variable) => context.auth[variable]);

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
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
            // Altering the response to fit the expected legacy output
            if (response.data.choices && response.data.choices.length > 0) {
                response.data.choices.forEach(choice => {
                    choice.text = choice.message?.content;
                    delete choice.message;
                });
            }

            return response;
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
