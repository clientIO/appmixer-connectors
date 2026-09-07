'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new global event is created
 * @extends {Component}
 */
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
        await context.saveState({ known: actual });
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

