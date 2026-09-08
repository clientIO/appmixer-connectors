'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new global event is created
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
        const { actor } = context.properties;

        const endpoint = actor === 'me'
            ? `users/${context.auth.profileInfo.login}/events`
            : `users/${context.auth.profileInfo.login}/received_events`;

        const res = await lib.apiRequest(context, endpoint);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(event => {
                return context.sendJson(event, 'event');

            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        const { actor } = context.properties;

        const endpoint = actor === 'me'
            ? `users/${context.auth.profileInfo.login}/events`
            : `users/${context.auth.profileInfo.login}/received_events`;

        // Events are returned newest-first by default.
        const event = await lib.fetchLatest(context, endpoint);
        if (!event) {
            throw new Error('No recent events to use as test data.');
        }
        return context.sendJson(event, 'event');
    }
};

