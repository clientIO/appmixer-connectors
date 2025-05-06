'use strict';
const lib = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new milestone is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/milestones`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, result => {
                return context.sendJson(result, 'out');
            });
        }
        await context.saveState({ known: actual });
    }
};

