'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { responseUrl, endpointId, requestId } = context.messages.in.content;

        let url = responseUrl;
        if (!url) {
            if (!endpointId || !requestId) {
                throw new context.CancelError('Provide either a Response URL, or both a Model Endpoint Id and a Request Id.');
            }
            url = lib.queueUrls(endpointId, requestId).responseUrl;
        }

        const NOT_READY = 'The request is not COMPLETED yet. Poll Get Request Status until the status '
            + 'is COMPLETED, then try again.';

        let response;
        try {
            response = await context.httpRequest({
                method: 'GET',
                url,
                headers: lib.authHeaders(context)
            });
        } catch (error) {
            // An unfinished request answers 400 {"detail":"Request is still in progress"} —
            // NOT 202. Without this branch the caller only sees a bare "status code 400".
            const status = error.response && error.response.status;
            const detail = error.response && error.response.data && error.response.data.detail;
            if (status === 400 && /still in progress/i.test(String(detail))) {
                throw new context.CancelError(NOT_READY);
            }
            return lib.handleError(context, error);
        }

        // Defensive: some queue paths answer 202 rather than 400 while still running.
        if (response.status === 202) {
            throw new context.CancelError(NOT_READY);
        }

        return context.sendJson({
            result: response.data,
            requestId
        }, 'out');
    }
};
