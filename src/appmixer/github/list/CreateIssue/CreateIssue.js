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
        if (!issue.title) {
            throw new context.CancelError('Title is required!');
        }

        // Normalize multiselect fields
        if (issue.assignees) {
            issue.assignees = lib.normalizeMultiselectInput(issue.assignees, context, 'Assignees');
        }
        if (issue.labels) {
            issue.labels = lib.normalizeMultiselectInput(issue.labels, context, 'Labels');
        }

        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/issues`, {
            method: 'POST',
            body: issue
        });

        return context.sendJson(data, 'newIssue');
    }
};
