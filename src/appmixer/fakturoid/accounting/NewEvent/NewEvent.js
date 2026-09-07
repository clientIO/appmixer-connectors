'use strict';
const fakturoid = require('../../fakturoid-commons');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        let events = await fakturoid.get('/events.json', context.auth, {});
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = [];
        let diff = [];

        if (Array.isArray(events)) {
            events.forEach(context.utils.processItem.bind(
                null, known, actual, diff, item => item['created_at']));
        }

        await Promise.map(diff, event => {
            return context.sendJson(event, 'event');
        });
        await context.saveState({ known: actual });
    },

    async test(context) {

        // Reuse the same request path as tick(). The events endpoint returns events
        // newest-first by default, so emit the first (latest) one. No dedup/state:
        // tick() suppresses the first poll (baseline), but test() must return a real item.
        const events = await fakturoid.get('/events.json', context.auth, {});
        const event = Array.isArray(events) ? events[0] : null;
        if (!event) {
            throw new Error('No recent event to use as test data.');
        }
        return context.sendJson(event, 'event');
    }
};
