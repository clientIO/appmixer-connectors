'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new milestone is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {
        const res = await commons.apiRequest(context, `users/${context.auth.profileInfo.login}/orgs`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = commons.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, result => {
                return context.sendJson(result, 'out');
            });
        }
        await context.saveState({ known: actual });
    }
};

