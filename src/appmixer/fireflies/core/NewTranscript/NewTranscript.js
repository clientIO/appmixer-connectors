'use strict';

const lib = require('../../lib');

const QUERY = `
    query NewTranscript($limit: Int) {
        transcripts(limit: $limit) {
            id
            title
            host_email
            organizer_email
            transcript_url
            meeting_link
            duration
            dateString
            date
            participants
        }
    }
`;

module.exports = {

    async tick(context) {

        const data = await lib.makeRequest({ context, query: QUERY, variables: { limit: 25 } });
        const transcripts = (data && data.transcripts) || [];

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const actual = [];
        const diff = [];

        for (const transcript of transcripts) {
            actual.push(transcript.id);
            // On the first tick `known` is null: establish a baseline without
            // emitting the existing backlog.
            if (known && !known.has(transcript.id)) {
                diff.push(transcript);
            }
        }

        for (const transcript of diff) {
            await context.sendJson(transcript, 'out');
        }

        await context.saveState({ known: actual });
    },

    // Flow Test Mode: emit the most recent transcript without touching state.
    async test(context) {

        const data = await lib.makeRequest({ context, query: QUERY, variables: { limit: 1 } });
        const transcript = data && data.transcripts && data.transcripts[0];

        if (!transcript) {
            throw new Error('No transcripts available to use as test data.');
        }

        return context.sendJson(transcript, 'out');
    }
};
