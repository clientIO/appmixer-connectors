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
    }
};
