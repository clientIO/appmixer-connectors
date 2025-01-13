'use strict';

module.exports = {

    receive: async function(context) {
        const { content } = context.messages.in;

        const transformedMessages = content.messages.ADD.map(message => ({
            role: content.model.includes('o1') && message.role === 'system' ? 'developer' : message.role,
            content: message.content
        }));
        context.log({ step: 'transformedMessages', transformedMessages });
        const transformedStopSequence = content.stop.ADD.map(sequence => {
            if (Object.keys(sequence).length > 0 && sequence.sequence !== '') {
                context.log({ step: 'sequence check', check: `sequence is not null or empty string: ${sequence.sequence}` });
                return sequence.sequence;
            }
        });
        const filteredStopSequence = transformedStopSequence.filter(s => s !== '');
        context.log({ step: 'transformedStopSequence', transformedStopSequence });
        context.log({ step: 'filteredStopSequence', filteredStopSequence });

        if (transformedStopSequence.length > 4) {
            throw new context.CancelError('Request can have a maximum of 4 stop sequences.');
        }

        const requestBody = {
            ...content,
            messages: transformedMessages,
            stop: filteredStopSequence.length > 0 ? filteredStopSequence : undefined
        };

        context.log({ step: 'requestBody', requestBody });

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
