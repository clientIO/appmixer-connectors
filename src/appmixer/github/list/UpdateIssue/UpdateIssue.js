'use strict';
const lib = require('../../lib');

/**
 * Component for updating an issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { issue, title = '', body = '', assignees = [], labels = [], milestone = '' } = context.messages.in.content;
        if (!issue) {
            throw new context.CancelError('Issue is required!');
        }
        let requestData = {};

        if (title) requestData.title = title;
        if (body) requestData.body = body;
        if (assignees.length) {
            requestData.assignees = lib.normalizeMultiselectInput(assignees, context, 'Assignees');
        }
        if (labels.length) {
            requestData.labels = lib.normalizeMultiselectInput(labels, context, 'Labels');
        }
        if (milestone) requestData.milestone = milestone;

        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/issues/${context.messages.in.content.issue}`, {
            method: 'PATCH',
            body: requestData
        });

        return context.sendJson(data, 'out');
    }
};
