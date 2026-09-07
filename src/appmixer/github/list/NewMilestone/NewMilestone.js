'use strict';
const lib = require('../../lib');

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
            await Promise.all(diff.map(result => {
                return context.sendJson(result, 'out');

            }));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // Fetch the newest milestone (across all states), sorted by creation date.
        const milestone = await lib.fetchLatest(context, `repos/${repositoryId}/milestones`, {
            params: { state: 'all', sort: 'created', direction: 'desc' }
        });
        if (!milestone) {
            throw new Error('No recent milestones to use as test data.');
        }
        return context.sendJson(milestone, 'out');
    }
};

