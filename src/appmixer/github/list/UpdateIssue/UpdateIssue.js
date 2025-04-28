'use strict';
const lib = require('../../lib');

/**
 * Component for updating an issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { title = '', body = '', assignees = [], labels = [], milestone = ''} = context.messages.in.content;
        let requestData = {};

        if (title) requestData.title = title;
        if (body) requestData.body = body;
        if (assignees.length) requestData.assignees = assignees;
        if (labels.length) requestData.labels = labels;
        if (milestone) requestData.milestone = milestone;
        
        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/issues/${context.messages.in.content.issue}`, {
            method: 'PATCH',
            body: requestData
        });

        return context.sendJson(data, 'out');
    }
};
