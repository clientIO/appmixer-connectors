'use strict';
const commons = require('../../lib');

/**
 * Component for fetching list of branches from repository
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        return commons.getAll(github, 'repos', 'listBranches',
            commons.buildUserRepoRequest(repositoryId)
        ).then(res => {
            return context.sendJson(res, 'branches');
        });
    }
};

