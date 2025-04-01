'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new commit is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId, branchId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        const res = await commons.getAll(
            github,
            'repos',
            'listCommits',
            commons.buildUserRepoRequest(repositoryId, { 'sha': branchId })
        );

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'sha'));
        }

        if (diff.size) {
            await Promise.map(diff, commit => {
                return context.sendJson(commit, 'commit');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

