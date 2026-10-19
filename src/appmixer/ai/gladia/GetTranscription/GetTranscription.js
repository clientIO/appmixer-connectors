'use strict';

const lib = require('../lib');

module.exports = {
    async receive(context) {

        const { transcriptionId } = context.messages.in.content;

        if (!transcriptionId) {
            throw new context.CancelError('Transcription ID is required!');
        }

        const job = await lib.makeRequest({
            context,
            method: 'GET',
            path: `/v2/transcription/${transcriptionId}`
        });

        if (!job || !job.id) {
            throw new context.CancelError(`Transcription ${transcriptionId} not found.`);
        }

        return context.sendJson(job, 'out');
    }
};
