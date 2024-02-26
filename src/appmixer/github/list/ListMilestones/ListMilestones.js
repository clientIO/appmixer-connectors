'use strict';
const commons = require('../../github-commons');

/**
 * Component for fetching list of milestones from repository
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { repositoryId } = context.properties;
        let github = commons.getGithubAPI(context.auth.accessToken);

        return commons.getAll(github, 'issues', 'listMilestonesForRepo',
            commons.buildUserRepoRequest(repositoryId)
        ).then(res => {
            return context.sendJson(res, 'milestones');
        });
    }
};

