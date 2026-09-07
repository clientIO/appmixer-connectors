'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new review is requested from a specified user
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId, username } = context.properties;

        const query = `review-requested:${username}+repo:${repositoryId}+is:pr`;

        const result = await lib.apiRequest(context, `search/issues?q=${query}`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, result.data.items, 'id');

        if (diff.length) {
            await Promise.all(diff.map(result => {
                return context.sendJson(result, 'out');

            }));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId, username } = context.properties;

        const query = `review-requested:${username}+repo:${repositoryId}+is:pr`;

        const result = await lib.fetchLatest(context, `search/issues?q=${query}`, {
            params: { sort: 'created', order: 'desc' }
        });
        if (!result) {
            throw new Error('No recent review requests to use as test data.');
        }
        return context.sendJson(result, 'out');
    }
};

