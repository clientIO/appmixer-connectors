'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { transcriptId } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }

        await context.httpRequest({
            method: 'DELETE',
            url: `${lib.getBaseUrl(context)}/v2/transcript/${transcriptId}`,
            headers: lib.getHeaders(context)
        });

        return context.sendJson({}, 'out');
    }
};
