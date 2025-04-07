'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new comment on a commit is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await commons.apiRequest(context, `repos/${repositoryId}/comments`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = commons.getNewItems(known, res.data, 'sha');

        if (diff.length) {
            await Promise.map(diff, comment => {
                return context.sendJson(comment, 'comment');
            });
        }
        await context.saveState({ known: actual });
    }
};
