'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { transcriptId } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.getBaseUrl(context)}/v2/transcript/${transcriptId}`,
            headers: lib.getHeaders(context)
        });

        if (data.status === 'error') {
            throw new context.CancelError(`Transcription failed: ${data.error}`);
        }

        return context.sendJson(data, 'out');
    }
};
