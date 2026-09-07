'use strict';
const lib = require('../../lib');

/**
 * Component which triggers whenever new collaborator is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await lib.apiRequest(context, `repos/${repositoryId}/collaborators`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(collaborator => {
                context.sendJson(collaborator, 'collaborator');
            }));
        }
        await context.saveState({ known: actual });
    },

    async test(context) {

        let { repositoryId } = context.properties;

        // The collaborators endpoint has no created sort; take the first listed collaborator.
        const collaborator = await lib.fetchLatest(context, `repos/${repositoryId}/collaborators`);
        if (!collaborator) {
            throw new Error('No collaborators to use as test data.');
        }
        return context.sendJson(collaborator, 'collaborator');
    }
};

