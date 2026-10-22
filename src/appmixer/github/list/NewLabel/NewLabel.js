'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new label is created
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

        const res = await lib.apiRequest(context, `repos/${repositoryId}/labels`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(label => {
                return context.sendJson(label, 'label');

            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The labels endpoint has no created sort; take the first listed label.
        const label = await lib.fetchLatest(context, `repos/${repositoryId}/labels`);
        if (!label) {
            throw new Error('No labels to use as test data.');
        }
        return context.sendJson(label, 'label');
    }
};

