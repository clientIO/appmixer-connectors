'use strict';
const commons = require('../../lib');
const lib = require('../../lib');

/**
 * Component for fetching list of assignees from repository
 * @extends {Component}
 */
// https://docs.github.com/en/rest/issues/assignees?apiVersion=2022-11-28#list-assignees
module.exports = {

    async receive(context) {

        let { repositoryId } = context.properties;

        const { data } = await lib.callEndpoint(context, `repos/${repositoryId}/assignees`, {
            method: 'POST',
            data: { issue }
        });

        return context.sendJson(data, 'assignees');

        let github = commons.getGithubAPI(context.auth.accessToken);

        return commons.getAll(github, 'issues', 'listAssignees',
            commons.buildUserRepoRequest(repositoryId)
        ).then(res => {
            return context.sendJson(res, 'assignees');
        });
    }
};
