'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new stargazer stars a repo
 * @extends {Component}
 */
module.exports = {
    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/stargazers`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(stargazer => {
                return context.sendJson(stargazer, 'stargazer');

            }));
        }

        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The stargazers endpoint has no created sort; take the first listed stargazer.
        const stargazer = await lib.fetchLatest(context, `repos/${repositoryId}/stargazers`);
        if (!stargazer) {
            throw new Error('No stargazers to use as test data.');
        }
        return context.sendJson(stargazer, 'stargazer');
    }
};
