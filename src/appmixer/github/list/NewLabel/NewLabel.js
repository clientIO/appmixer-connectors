'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new label is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {
        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/labels`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(label => {
                return context.sendJson(label, 'label');

            }));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The labels endpoint has no created sort; take the first listed label.
        const label = await lib.fetchLatest(context, `repos/${repositoryId}/labels`);
        if (!label) {
            throw new Error('No labels to use as test data.');
        }
        return context.sendJson(label, 'label');
    }
};

