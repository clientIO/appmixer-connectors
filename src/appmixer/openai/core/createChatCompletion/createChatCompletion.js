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

        let url = lib.getBaseUrl(context) + '/chat/completions';

        const headers = {};

        const inputMapping = {
            'model': input['model'],
            'frequency_penalty': input['frequency_penalty'],
            'max_tokens': input['max_tokens'],
            'n': input['n'],
            'presence_penalty': input['presence_penalty'],
            'seed': input['seed'],
            'stop': input['stop'],
            'stream': input['stream'],
            'temperature': input['temperature'],
            'top_p': input['top_p'],
            'tools': input['tools'],
            'tool_choice': input['tool_choice'],
            'user': input['user'],
            'function_call': input['function_call'],
            'functions': input['functions'],
            'messages': [{
                role: input['prompt_role'],
                content: input['prompt_content'],
                name: input['prompt_name']
            }],
            'response_format.type': input['response_format|type']
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
