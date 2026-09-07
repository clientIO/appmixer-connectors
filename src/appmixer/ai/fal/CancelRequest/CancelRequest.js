'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { cancelUrl, endpointId, requestId } = context.messages.in.content;

        let url = cancelUrl;
        if (!url) {
            if (!endpointId || !requestId) {
                throw new context.CancelError('Provide either a Cancel URL, or both a Model Endpoint Id and a Request Id.');
            }
            url = lib.queueUrls(endpointId, requestId).cancelUrl;
        }

        try {
            await context.httpRequest({
                method: 'PUT',
                url,
                headers: lib.authHeaders(context)
            });
        } catch (error) {
            // Cancelling an already COMPLETED request returns 400 — surface it as a friendly message.
            if (error.response && error.response.status === 400) {
                throw new context.CancelError(
                    'The request could not be cancelled — it is already completed (or not cancellable).'
                );
            }
            return lib.handleError(context, error);
        }

        return context.sendJson({}, 'out');
    }
};
