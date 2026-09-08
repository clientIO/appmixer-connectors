'use strict';

const pathModule = require('path');
const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { meetingId, fileName } = context.messages.in.content;

        if (!meetingId) {
            throw new context.CancelError('Meeting ID is required!');
        }

        // Step 1 — resolve the short-lived signed URL from the 302 redirect without
        // following it (the storage host rejects the x-api-key header).
        let redirect;
        try {
            redirect = await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/${lib.API_VERSION}/meetings/${encodeURIComponent(meetingId)}/download`,
                headers: lib.getHeaders(context),
                maxRedirects: 0,
                validateStatus: (status) => status === 302 || status === 301 || (status >= 200 && status < 300)
            });
        } catch (error) {
            throw lib.toCancelError(context, error);
        }

        const headers = redirect.headers || {};
        const downloadUrl = headers.location || headers.Location;

        if (!downloadUrl) {
            throw new context.CancelError('tl;dv did not return a recording download URL. The recording may not be ready yet.');
        }

        // Step 2 — stream the recording (potentially large) straight into file storage.
        const download = await context.httpRequest({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
        });

        const resolvedName = fileName || `tldv-recording-${meetingId}.mp4`;
        const saved = await context.saveFileStream(pathModule.normalize(resolvedName), download.data);

        return context.sendJson({
            fileId: saved.fileId,
            fileName: resolvedName,
            meetingId
        }, 'out');
    }
};
