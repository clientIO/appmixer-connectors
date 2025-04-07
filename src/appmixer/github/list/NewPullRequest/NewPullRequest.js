'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * Component which triggers whenever new pull request is created.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;
        const res = await lib.apiRequest(context, `repos/${repositoryId}/pulls`);

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, branch => {
                context.sendJson(branch, 'pullRequest');
            });
        }
        await context.saveState({ known: actual });
    }
};

