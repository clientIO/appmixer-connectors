'use strict';

const lib = require('../../lib');

// The signed URL tl;dv redirects to is valid for 6 hours.
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

module.exports = {

    async receive(context) {

        const { meetingId } = context.messages.in.content;

        if (!meetingId) {
            throw new context.CancelError('Meeting ID is required!');
        }

        // GET /download responds with a 302 redirect to a short-lived signed URL. We must
        // NOT follow the redirect (the signed URL points at storage that rejects our
        // x-api-key header) — instead read the Location header off the 302.
        let response;
        try {
            response = await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/${lib.API_VERSION}/meetings/${encodeURIComponent(meetingId)}/download`,
                headers: lib.getHeaders(context),
                maxRedirects: 0,
                validateStatus: (status) => status === 302 || status === 301 || (status >= 200 && status < 300)
            });
        } catch (error) {
            throw lib.toCancelError(context, error);
        }

        const headers = response.headers || {};
        const downloadUrl = headers.location || headers.Location;

        if (!downloadUrl) {
            throw new context.CancelError('tl;dv did not return a recording download URL. The recording may not be ready yet.');
        }

        return context.sendJson({
            downloadUrl,
            expiresInSeconds: SIGNED_URL_TTL_SECONDS
        }, 'out');
    }
};
