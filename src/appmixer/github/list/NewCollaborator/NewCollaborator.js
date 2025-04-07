'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new collaborator is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;

        const res = await commons.apiRequest(context, `repos/${repositoryId}/collaborators`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;

        const { diff, actual } = commons.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.map(diff, collaborator => {
                context.sendJson(collaborator, 'collaborator');
            });
        }
        await context.saveState({ known: actual });
    }
};

