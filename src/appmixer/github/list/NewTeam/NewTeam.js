'use strict';
const lib = require('../../lib');

/**
 * Component which triggers when user is added to new team
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

        const res = await lib.apiRequest(context, 'user/teams');

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');
        if (diff.length) {
            await Promise.all(diff.map(team => {
                return context.sendJson(team, 'out');

            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        // The user/teams endpoint has no created sort; take the first listed team.
        const team = await lib.fetchLatest(context, 'user/teams');
        if (!team) {
            throw new Error('No teams to use as test data.');
        }
        return context.sendJson(team, 'out');
    }
};
