'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new stargazer stars a repo
 * @extends {Component}
 */
/**
 * Maximum number of IDs to retain in context.state.known.
 * getNewItems() replaces (not accumulates) known each tick, so this cap only
 * fires if a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

module.exports = {
    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/stargazers`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(stargazer => {
                return context.sendJson(stargazer, 'stargazer');

            }));
        }

        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The stargazers endpoint has no created sort; take the first listed stargazer.
        const stargazer = await lib.fetchLatest(context, `repos/${repositoryId}/stargazers`);
        if (!stargazer) {
            throw new Error('No stargazers to use as test data.');
        }
        return context.sendJson(stargazer, 'stargazer');
    }
};
