'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new event is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/events`);

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

        let { repositoryId } = context.properties;

        // Events are returned newest-first by default.
        const event = await lib.fetchLatest(context, `repos/${repositoryId}/events`);
        if (!event) {
            throw new Error('No recent events to use as test data.');
        }
        return context.sendJson(event, 'event');
    }
};

