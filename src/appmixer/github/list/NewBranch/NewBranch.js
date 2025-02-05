'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new branch is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let github = commons.getGithubAPI(context.auth.accessToken);
        let { repositoryId } = context.properties;

        const res = await commons.getAll(
            github,
            'repos',
            'listBranches',
            commons.buildUserRepoRequest(repositoryId)
        );
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'name'));
        }

        if (diff.size) {
            await Promise.map(diff, branch => {
                context.sendJson(branch, 'branch');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

