'use strict';
const lib = require('../../lib');

/**
 * Component which triggers when a new notification is received
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

        const res = await lib.apiRequest(context, 'notifications');

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');
        if (diff.length) {
            await Promise.all(diff.map(issue => {
                return context.sendJson(issue, 'out');

            }));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        // Notifications are returned newest-first by default.
        const notification = await lib.fetchLatest(context, 'notifications');
        if (!notification) {
            throw new Error('No recent notifications to use as test data.');
        }
        return context.sendJson(notification, 'out');
    }
};
