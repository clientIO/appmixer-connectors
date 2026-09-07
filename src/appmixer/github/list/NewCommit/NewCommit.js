'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new commit is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { repositoryId, branchId } = context.properties;

        const params = {};
        if (branchId) {
            params.sha = branchId;
        }

        const res = await lib.apiRequest(context, `repos/${repositoryId}/commits`, { params });

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'sha');
        if (diff.length) {
            await Promise.all(diff.map(commit => context.sendJson(commit, 'commit')));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        const { repositoryId, branchId } = context.properties;

        const params = {};
        if (branchId) {
            params.sha = branchId;
        }

        // Commits are returned newest-first by default.
        const commit = await lib.fetchLatest(context, `repos/${repositoryId}/commits`, { params });
        if (!commit) {
            throw new Error('No recent commits to use as test data.');
        }
        return context.sendJson(commit, 'commit');
    }
};
