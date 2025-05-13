'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * Component which triggers when user is added to new team
 * @extends {Component}
 */
module.exports = {
    async tick(context) {

        const res = await lib.apiRequest(context, 'user/teams');

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');
        if (diff.length) {
            await Promise.map(diff, team => {
                return context.sendJson(team, 'out');
            });
        }
        await context.saveState({ known: actual });
    }
};
