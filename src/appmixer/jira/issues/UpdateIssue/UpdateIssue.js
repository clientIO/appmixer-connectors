'use strict';

const commons = require('../../jira-commons');

function buildIssue(issueInfo) {

    const {
        parent,
        issuetype,
        components,
        project,
        description,
        reporter,
        fixVersions,
        priority,
        security,
        environment,
        versions,
        assignee
    } = issueInfo;

    if (parent) {
        issueInfo.parent = { key: parent };
    }

    if (issuetype) {
        issueInfo.issuetype = { id: issuetype };
    }

    if (Array.isArray(components)) {
        issueInfo.components = components.map(component => ({ id: component }));
    }

    if (project) {
        issueInfo.project = { id: project };
    }

    if (description) {
        issueInfo.description = commons.buildDocType(description);
    }

    if (reporter) {
        issueInfo.reporter = { id: reporter };
    }

    if (Array.isArray(fixVersions)) {
        issueInfo.fixVersions = fixVersions.map(fixVersion => ({ id: fixVersion }));
    }

    if (priority) {
        issueInfo.priority = { id: priority };
    }

    if (security) {
        issueInfo.security = { id: security };
    }

    if (environment) {
        issueInfo.environment = commons.buildDocType(environment);
    }

    if (Array.isArray(versions)) {
        issueInfo.versions = versions.map(version => ({ id: version }));
    }

    if (assignee) {
        issueInfo.assignee = { id: assignee };
    }

    return {
        fields: issueInfo
    };
}

module.exports = {
    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { project, issueType } = context.properties;

        const issue = context.messages.in.content;
        issue.project = project;
        issue.issuetype = issueType;

        const id = issue.id;
        delete issue.id;

        await commons.put(`${apiUrl}issue/${id}`, auth, buildIssue(issue));
        return context.sendJson({ id }, 'out');
    }
};
