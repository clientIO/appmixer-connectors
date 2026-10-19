'use strict';

const lib = require('../lib');

const PAGE_SIZE = 50;
// Safety cap so a backlog (or a first tick against a large account) cannot page
// through the whole history in a single tick.
const MAX_PAGES = 20;
// How many recently emitted job ids to remember. This is what stops a job from
// being emitted twice when an unrelated deletion shifts it back onto an earlier
// page, so it is kept comfortably larger than a single page.
const SEEN_LIMIT = 1000;

/**
 * Fetch one page of completed transcriptions, newest first.
 * The Gladia list endpoint supports only `status`, `offset` and `limit` — it
 * rejects any sort or date filter — so a watermark has to be applied client side.
 * @param {object} context
 * @param {number} offset
 * @returns {Promise<Array<object>>}
 */
async function fetchPage(context, offset) {

    const data = await lib.makeRequest({
        context,
        method: 'GET',
        path: '/v2/transcription',
        params: { status: 'done', limit: PAGE_SIZE, offset }
    });

    return (data && data.items) || [];
}

/**
 * Completion timestamp used for ordering, falling back to creation time for
 * payloads that omit `completed_at`.
 * @param {object} item
 * @returns {string}
 */
function completionKey(item) {
    return (item && (item.completed_at || item.created_at)) || '';
}

module.exports = {

    async tick(context) {

        const state = context.state || {};
        const watermark = state.watermark || null;
        const watermarkIds = Array.isArray(state.watermarkIds) ? new Set(state.watermarkIds) : new Set();
        const seen = Array.isArray(state.seen) ? state.seen : [];
        const seenSet = new Set(seen);

        // Page back until a page adds nothing new. Without this only the newest
        // PAGE_SIZE jobs would ever be inspected, so a burst of completions
        // between two ticks would be missed permanently.
        const collected = [];
        for (let page = 0; page < MAX_PAGES; page++) {

            const items = await fetchPage(context, page * PAGE_SIZE);
            if (!items.length) {
                break;
            }

            let pageHadCandidate = false;
            for (const item of items) {
                const key = completionKey(item);
                const isNewer = !watermark || key > watermark;
                const isWatermarkTie = watermark && key === watermark && !watermarkIds.has(item.id);

                if ((isNewer || isWatermarkTie) && !seenSet.has(item.id)) {
                    pageHadCandidate = true;
                    collected.push(item);
                }
            }

            // Everything on this page is at or below the watermark (or already
            // emitted), so older pages cannot hold anything new either.
            if (!pageHadCandidate || items.length < PAGE_SIZE) {
                break;
            }
        }

        // On the very first tick establish a baseline without emitting the
        // existing backlog of completed jobs.
        const isFirstTick = !watermark && !state.seen;

        // Oldest first, so downstream components observe completion order.
        collected.sort((a, b) => (completionKey(a) < completionKey(b) ? -1 : 1));

        if (!isFirstTick) {
            for (const item of collected) {
                await context.sendJson(item, 'out');
            }
        }

        const highest = collected.reduce(
            (max, item) => (completionKey(item) > max ? completionKey(item) : max),
            watermark || ''
        );

        const nextSeen = seen.concat(collected.map(item => item.id)).slice(-SEEN_LIMIT);

        await context.saveState({
            watermark: highest || null,
            watermarkIds: collected
                .filter(item => completionKey(item) === highest)
                .map(item => item.id)
                .concat(highest === watermark ? Array.from(watermarkIds) : []),
            seen: nextSeen
        });
    },

    // Flow Test Mode: emit the most recent completed transcription without
    // touching state.
    async test(context) {

        const data = await lib.makeRequest({
            context,
            method: 'GET',
            path: '/v2/transcription',
            params: { status: 'done', limit: 1 }
        });

        const item = data && data.items && data.items[0];

        if (!item) {
            throw new Error('No completed transcriptions available to use as test data.');
        }

        return context.sendJson(item, 'out');
    }
};
