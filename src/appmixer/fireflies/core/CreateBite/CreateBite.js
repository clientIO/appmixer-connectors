'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { transcriptId, start, end, name } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }
        if (start === undefined || start === null || start === '') {
            throw new context.CancelError('Start time is required!');
        }
        if (end === undefined || end === null || end === '') {
            throw new context.CancelError('End time is required!');
        }

        // Creates a soundbite (highlight clip) from a section of a transcript,
        // defined by start/end offsets in seconds.
        const query = `
            mutation CreateBite($transcript_Id: ID!, $start_time: Float!, $end_time: Float!, $name: String) {
                createBite(transcript_Id: $transcript_Id, start_time: $start_time, end_time: $end_time, name: $name) {
                    id
                    name
                    status
                }
            }
        `;

        const variables = {
            transcript_Id: transcriptId,
            start_time: parseFloat(start),
            end_time: parseFloat(end)
        };
        if (name) variables.name = name;

        const data = await lib.makeRequest({ context, query, variables });

        return context.sendJson((data && data.createBite) || {}, 'out');
    }
};
