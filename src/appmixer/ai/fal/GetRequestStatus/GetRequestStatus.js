'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { statusUrl, endpointId, requestId, includeLogs } = context.messages.in.content;

        let url = statusUrl;
        if (!url) {
            if (!endpointId || !requestId) {
                throw new context.CancelError('Provide either a Status URL, or both a Model Endpoint Id and a Request Id.');
            }
            url = lib.queueUrls(endpointId, requestId).statusUrl;
        }

        const response = await lib.request(context, {
            method: 'GET',
            url,
            headers: lib.authHeaders(context),
            params: includeLogs ? { logs: 1 } : undefined
        });

        const data = response.data || {};
        return context.sendJson({
            status: data.status,
            queuePosition: data.queue_position,
            logs: data.logs || [],
            responseUrl: data.response_url
        }, 'out');
    }
};
