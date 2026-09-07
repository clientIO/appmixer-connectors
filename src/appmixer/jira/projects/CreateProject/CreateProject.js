'use strict';
const commons = require('../../jira-commons');

module.exports = {
    async receive(context) {

        const { profileInfo: { apiUrl, accountId }, auth } = context;
        const { projectType } = context.properties;

        const project = context.messages.in.content;

        if (!project.key) {
            throw new context.CancelError('Key is required!');
        }
        if (!project.name) {
            throw new context.CancelError('Name is required!');
        }
        if (!project.projectTemplateKey) {
            throw new context.CancelError('Project Template Key is required!');
        }

        // Default the project lead to the connected user when not provided.
        if (!project.leadAccountId) {
            project.leadAccountId = accountId;
        }

        project.projectTypeKey = projectType;

        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-post
        const result = await commons.post(`${apiUrl}project`, auth, project);
        return context.sendJson(result, 'project');
    }
};
