'use strict';

const lib = require('../lib');

module.exports = {

    async tick(context) {

        const baseUrl = lib.getBaseUrl(context);
        const headers = lib.getHeaders(context);
        const includeFull = context.properties.includeFullTranscript !== false;

        const previousIds = Array.isArray(context.state.seen) ? context.state.seen : null;
        const seen = previousIds ? new Set(previousIds) : null;

        const { records, truncated } = await lib.fetchTranscriptsUntilSeen(context, { status: 'completed', seen });

        if (truncated) {
            await context.log({
                step: 'Poll window truncated',
                message: 'More completed transcripts than the poll window covers; consider a shorter tick interval.'
            });
        }

        // First poll establishes a baseline and does not emit.
        if (seen === null) {
            await context.saveState({ seen: lib.mergeSeenIds(records.map(t => t.id), []) });
            return;
        }

        for (const summary of records) {
            let payload = summary;
            if (includeFull) {
                const { data: full } = await context.httpRequest({
                    method: 'GET',
                    url: `${baseUrl}/v2/transcript/${summary.id}`,
                    headers
                });
                payload = full;
            }
            await context.sendJson(payload, 'transcript');
        }

        await context.saveState({ seen: lib.mergeSeenIds(records.map(t => t.id), previousIds) });
    },

    async test(context) {

        const baseUrl = lib.getBaseUrl(context);
        const headers = lib.getHeaders(context);

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${baseUrl}/v2/transcript`,
            headers,
            params: { limit: 1, status: 'completed' }
        });

        const summary = data && Array.isArray(data.transcripts) ? data.transcripts[0] : null;
        if (!summary) {
            throw new Error('No completed transcript to use as test data.');
        }

        if (context.properties.includeFullTranscript !== false) {
            const { data: full } = await context.httpRequest({
                method: 'GET',
                url: `${baseUrl}/v2/transcript/${summary.id}`,
                headers
            });
            return context.sendJson(full, 'transcript');
        }

        return context.sendJson(summary, 'transcript');
    }
};
