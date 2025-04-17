'use strict';
const lib = require('../../lib');

/**
 * Component for updating an issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let repositoryId = context.properties.repositoryId;
        let issue = context.messages.in.content;

        if (issue.labelId) {
            issue.labels = [issue.labelId];
            delete issue.labelId;
        }

        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/issues/${context.messages.in.content.issue}`, {
            method: 'PATCH',
            body: issue
        });

        return context.sendJson(data, 'out');
    }
};
