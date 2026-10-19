'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new organization is created
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
        const res = await lib.apiRequest(context, `users/${context.auth.profileInfo.login}/orgs`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(result => {
                return context.sendJson(result, 'out');

            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        // The orgs endpoint has no created sort; take the first listed organization.
        const org = await lib.fetchLatest(context, `users/${context.auth.profileInfo.login}/orgs`);
        if (!org) {
            throw new Error('No organizations to use as test data.');
        }
        return context.sendJson(org, 'out');
    }
};

