'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new comment on a commit is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/comments`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'sha');

        if (diff.length) {
            await Promise.all(diff.map(comment => {
                return context.sendJson(comment, 'comment');

            }));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // Commit comments are returned newest-first by default.
        const comment = await lib.fetchLatest(context, `repos/${repositoryId}/comments`);
        if (!comment) {
            throw new Error('No recent commit comments to use as test data.');
        }
        return context.sendJson(comment, 'comment');
    }
};
