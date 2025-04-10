'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

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

        const res = await commons.apiRequest(context, endpoint);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = commons.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, event => {
                return context.sendJson(event, 'event');
            });
        }
        await context.saveState({ known: actual });
    }
};

