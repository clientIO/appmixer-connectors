'use strict';
const Promise = require('bluebird');
const commons = require('../../lib');

/**
 * Component which triggers whenever new stargazer stars a repo
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        const res = await commons.getAll(
            github,
            'activity',
            'listStargazersForRepo',
            commons.buildUserRepoRequest(repositoryId)
        );

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'id'));
        }

        if (diff.size) {
            await Promise.map(diff, issue => {
                return context.sendJson(issue, 'stargazer');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    }
};

