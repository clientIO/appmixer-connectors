'use strict';

const lib = require('../lib');

// Shared fetch path used by both tick() and test().
async function fetchRequests(context, extraParams = {}) {

    const { projectId } = context.properties;

    if (!projectId) {
        throw new context.CancelError('Project is required!');
    }

    const { data } = await lib.apiRequest(context, {
        method: 'GET',
        path: `/v1/projects/${encodeURIComponent(projectId)}/requests`,
        // 100 is Deepgram's maximum page size here; larger values are rejected with
        // "Invalid value for 'limit' parameter".
        params: { limit: 100, ...extraParams }
    });

    return (data && data.requests) || [];
}

module.exports = {

    async tick(context) {

        const requests = await fetchRequests(context);

        // Sort order of /requests is not documented, so we dedupe by request_id
        // against a known-id set rather than relying on ordering or cursors.
        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, requests, 'request_id');

        if (diff.length) {
            await Promise.all(diff.map(request => context.sendJson(request, 'out')));
        }

        await context.saveState({ known: actual });
    },

    // Flow Test Mode: emit the single most recent request, read-only, no state writes.
    async test(context) {

        const requests = await fetchRequests(context);
        if (!requests.length) {
            throw new Error('No recent requests to use as test data.');
        }
        return context.sendJson(requests[0], 'out');
    }
};
