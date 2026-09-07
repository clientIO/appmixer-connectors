'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new watcher is added to a repo
 * @extends {Component}
 */
module.exports = {
    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/watchers`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(watcher => {
                return context.sendJson(watcher, 'out');

            }));
        }

        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The watchers endpoint has no created sort; take the first listed watcher.
        const watcher = await lib.fetchLatest(context, `repos/${repositoryId}/watchers`);
        if (!watcher) {
            throw new Error('No watchers to use as test data.');
        }
        return context.sendJson(watcher, 'out');
    }
};
