'use strict';
const lib = require('../../lib');

/**
 * https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#list-gists-for-the-authenticated-user
 */
/**
 * Maximum number of IDs to retain in context.state.known.
 * getNewItems() replaces (not accumulates) known each tick, so this cap only
 * fires if a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

module.exports = {

    async tick(context) {

        const res = await lib.apiRequest(context, 'gists');

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(gist => {
                context.sendJson(gist, 'gist');
            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        // Gists are returned newest-first by default.
        const gist = await lib.fetchLatest(context, 'gists');
        if (!gist) {
            throw new Error('No recent gists to use as test data.');
        }
        return context.sendJson(gist, 'gist');
    }
};

