'use strict';
const commons = require('../../github-commons');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new event is created
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        const res = await commons.getAll(
            github, 'activity', 'listRepoEvents', commons.buildUserRepoRequest(repositoryId)
        );
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(res)) {
            res.forEach(commons.processItems.bind(null, known, actual, diff, 'id'));
        }

        if (diff.size) {
            await Promise.map(diff, event => {
                return context.sendJson(event, 'event');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

