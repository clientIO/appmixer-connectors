'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new pull request is created.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        const res = await commons.getAll(
            github,
            'pulls',
            'list',
            commons.buildUserRepoRequest(repositoryId)
        );
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'id'));
        }

        if (diff.size) {
            await Promise.map(diff, pr => {
                return context.sendJson(pr, 'pullRequest');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    }
};

