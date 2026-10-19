'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { endpointId, arguments: args, webhookUrl, priority, timeout } = context.messages.in.content;

        if (!endpointId) {
            throw new context.CancelError('Model Endpoint Id is required!');
        }

        const body = lib.parseArguments(context, args);
        const requestOptions = {
            method: 'POST',
            url: `${lib.QUEUE_URL}/${endpointId}`,
            headers: {
                ...lib.authHeaders(context),
                ...lib.advancedHeaders({ priority, timeout }),
                'Content-Type': 'application/json'
            },
            data: body
        };

        if (webhookUrl) {
            // fal delivers the completion callback to the URL passed as the
            // fal_webhook query parameter on submit.
            requestOptions.params = { fal_webhook: webhookUrl };
        }

        const response = await lib.request(context, requestOptions);
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
