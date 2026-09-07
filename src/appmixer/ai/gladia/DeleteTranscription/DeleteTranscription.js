'use strict';

const lib = require('../lib');

module.exports = {
    async receive(context) {

        const { transcriptionId } = context.messages.in.content;

        if (!transcriptionId) {
            throw new context.CancelError('Transcription ID is required!');
        }

        // Permanently deletes the job and its data. Irreversible.
        await lib.makeRequest({
            context,
            method: 'DELETE',
            path: `/v2/transcription/${transcriptionId}`
        });

        return context.sendJson({}, 'out');
    }
};
