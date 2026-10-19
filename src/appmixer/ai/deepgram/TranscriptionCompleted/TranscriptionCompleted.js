'use strict';

const lib = require('../lib');

// Fetch successful transcription (/v1/listen) requests. Shared by tick() and test().
async function fetchCompletedTranscriptions(context) {

    const { projectId } = context.properties;

    if (!projectId) {
        throw new context.CancelError('Project is required!');
    }

    const { data } = await lib.apiRequest(context, {
        method: 'GET',
        path: `/v1/projects/${encodeURIComponent(projectId)}/requests`,
        // 100 is Deepgram's maximum page size here; larger values are rejected with
        // "Invalid value for 'limit' parameter".
        params: { status: 'succeeded', limit: 100 }
    });

    return ((data && data.requests) || [])
        .filter(request => typeof request.path === 'string' && request.path.indexOf('/v1/listen') !== -1);
}

// Optionally attach the full stored result. Shared by tick() and test().
async function enrich(context, request, includeResult) {

    if (!includeResult) {
        return request;
    }

    const { projectId } = context.properties;
    try {
        const { data: full } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/v1/projects/${encodeURIComponent(projectId)}/requests/${encodeURIComponent(request.request_id)}`
        });
        return { ...request, response: full && full.response ? full.response : full };
    } catch (error) {
        await context.log('error', `Failed to fetch full result for request ${request.request_id}`, { message: error.message });
        return request;
    }
}

module.exports = {

    async tick(context) {

        // With Include Result on, a single tick can issue up to 1000 sequential detail
        // requests and run well past the polling interval. Without a lock the next tick
        // would start on the same `known` set and re-emit everything this one is still
        // working through, so hold the component lock across fetch/diff/send/save.
        let lock;
        try {
            lock = await context.lock(context.componentId, {
                ttl: 10 * 60 * 1000,
                maxRetryCount: 0
            });
        } catch (e) {
            return; // Another tick still owns this component - skip this round.
        }

        try {
            const { includeResult = true } = context.properties;
            const requests = await fetchCompletedTranscriptions(context);

            const state = await context.loadState();
            const known = Array.isArray(state.known) ? new Set(state.known) : null;
            const { diff, actual } = lib.getNewItems(known, requests, 'request_id');

            for (const request of diff) {
                const payload = await enrich(context, request, includeResult);
                await context.sendJson(payload, 'out');
            }

            await context.saveState({ known: actual });
        } finally {
            await lock.unlock();
        }
    },

    // Flow Test Mode: emit the single most recent completed transcription, read-only, no state writes.
    async test(context) {

        const { includeResult = true } = context.properties;
        const requests = await fetchCompletedTranscriptions(context);
        if (!requests.length) {
            throw new Error('No recent completed transcriptions to use as test data.');
        }
        const payload = await enrich(context, requests[0], includeResult);
        return context.sendJson(payload, 'out');
    }
};
