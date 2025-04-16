'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * Component which triggers when a new notification is received
 * @extends {Component}
 */
module.exports = {
    async tick(context) {

        const res = await lib.apiRequest(context, 'notifications');

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');
        if (diff.length) {
            await Promise.map(diff, issue => {
                return context.sendJson(issue, 'out');
            });
        }
        await context.saveState({ known: actual });
    }
};
