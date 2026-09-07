'use strict';
const lib = require('../../lib');

/**
 * https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#list-gists-for-the-authenticated-user
 */
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
        await context.saveState({ known: actual });
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

