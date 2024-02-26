'use strict';
const commons = require('../../github-commons');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new collaborator is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        const res = await commons.getAll(
            github,
            'repos',
            'listCollaborators',
            commons.buildUserRepoRequest(repositoryId)
        );
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'id'));
        }

        if (diff.size) {
            await Promise.map(diff, collaborator => {
                context.sendJson(collaborator, 'collaborator');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

