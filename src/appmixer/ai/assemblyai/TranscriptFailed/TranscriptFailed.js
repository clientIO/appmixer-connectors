'use strict';

const lib = require('../lib');

module.exports = {

    async tick(context) {

        const previousIds = Array.isArray(context.state.seen) ? context.state.seen : null;
        const seen = previousIds ? new Set(previousIds) : null;

        const { records, truncated } = await lib.fetchTranscriptsUntilSeen(context, { status: 'error', seen });

        if (truncated) {
            await context.log({
                step: 'Poll window truncated',
                message: 'More failed transcripts than the poll window covers; consider a shorter tick interval.'
            });
        }

        // First poll establishes a baseline and does not emit.
        if (seen === null) {
            await context.saveState({ seen: lib.mergeSeenIds(records.map(t => t.id), []) });
            return;
        }

        for (const summary of records) {
            await context.sendJson(summary, 'transcript');
        }

        await context.saveState({ seen: lib.mergeSeenIds(records.map(t => t.id), previousIds) });
    },

    async test(context) {

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.getBaseUrl(context)}/v2/transcript`,
            headers: lib.getHeaders(context),
            params: { limit: 1, status: 'error' }
        });

        const summary = data && Array.isArray(data.transcripts) ? data.transcripts[0] : null;
        if (!summary) {
            throw new Error('No failed transcript to use as test data.');
        }
        return context.sendJson(summary, 'transcript');
    }
};
