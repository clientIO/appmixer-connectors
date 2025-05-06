'use strict';
const Promise = require('bluebird');
const lib = require('../../lib');

/**
 * Component which triggers whenever new branch is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/branches`);

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'name');

        if (diff.length) {
            await Promise.map(diff, branch => {
                context.sendJson(branch, 'branch');
            });
        }
        await context.saveState({ known: actual });
    }
};

