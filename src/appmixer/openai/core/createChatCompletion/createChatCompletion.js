'use strict';

module.exports = {

    receive: async function(context) {
        const { content } = context.messages.in;

        const transformedMessages = content.messages.ADD.map(message => ({
            role: content.model.includes('o1') && message.role === 'system' ? 'developer' : message.role,
            content: message.content
        }));
        const transformedStopSequence = content.stop.ADD.reduce((acc, sequence) => {
            if (sequence.sequence) {
                context.log({ step: 'sequence check', check: `sequence is not null or empty string: ${sequence.sequence}` });
                acc.push(sequence.sequence);
            }
            return acc;
        }, []);

        if (transformedStopSequence.length > 4) {
            throw new context.CancelError('Request can have a maximum of 4 stop sequences.');
        }

        const requestBody = {
            ...content,
            messages: transformedMessages,
            stop: transformedStopSequence.length > 0 ? transformedStopSequence : undefined
        };

        const req = {
            url: 'https://api.openai.com/v1/chat/completions',
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
