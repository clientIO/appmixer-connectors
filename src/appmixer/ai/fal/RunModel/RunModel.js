'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            endpointId,
            arguments: args,
            waitForResult = true,
            priority,
            timeout,
            storeIO,
            noRetry
        } = context.messages.in.content;

        if (!endpointId) {
            throw new context.CancelError('Model Endpoint Id is required!');
        }

        const body = lib.parseArguments(context, args);
        const headers = {
            ...lib.authHeaders(context),
            ...lib.advancedHeaders({ priority, timeout, storeIO, noRetry }),
            'Content-Type': 'application/json'
        };

        if (waitForResult) {

            // Synchronous inference, bounded to 60 seconds. Longer models (video,
            // training) must go through the queue components instead.
            let response;
            try {
                response = await context.httpRequest({
                    method: 'POST',
                    url: `${lib.RUN_URL}/${endpointId}`,
                    headers,
                    data: body,
                    timeout: 60000
                });
            } catch (error) {
                if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
                    throw new context.CancelError(
                        'The synchronous call exceeded the 60 second limit. Turn off Wait For Result to '
                        + 'submit this model to the queue, then poll with Get Request Status / Get Request Result.'
                    );
                }
                return lib.handleError(context, error);
            }

            await lib.logInference(context, response);

            return context.sendJson({
                result: response.data,
                requestId: response.headers['x-fal-request-id']
            }, 'out');
        }

        // Asynchronous submit: return the queue handles immediately.
        const response = await lib.request(context, {
            method: 'POST',
            url: `${lib.QUEUE_URL}/${endpointId}`,
            headers,
            data: body
        });

        await lib.logInference(context, response);

        const data = response.data || {};
        return context.sendJson({
            requestId: data.request_id,
            statusUrl: data.status_url,
            responseUrl: data.response_url,
            cancelUrl: data.cancel_url,
            queuePosition: data.queue_position
        }, 'out');
    }
};
