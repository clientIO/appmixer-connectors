'use strict';
const lib = require('../../lib');

/**
 * Component for creating a new issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let repositoryId = context.properties.repositoryId;
        let issue = context.messages.issue.content;

        if (issue.labelId) {
            issue.labels = [issue.labelId];
            delete issue.labelId;
        }

        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/issues`, {
            method: 'POST',
            body: issue
        });

        return context.sendJson(data, 'newIssue');
    }
};
