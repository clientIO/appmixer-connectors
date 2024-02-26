'use strict';
const commons = require('../../github-commons');

/**
 * Component for creating a new issue
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let repositoryId = context.properties.repositoryId;
        let issue = context.messages.issue.content;

        if (issue.labelId) {
            issue.labels = [issue.labelId];
            delete issue.labelId;
        }

        let github = commons.getGithubAPI(context.auth.accessToken);

        return github.issues.create(
            commons.buildUserRepoRequest(
                repositoryId,
                issue
            )
        ).then(newIssue => {
            const { data } = newIssue;
            return context.sendJson(data, 'newIssue');
        });
    }
};
