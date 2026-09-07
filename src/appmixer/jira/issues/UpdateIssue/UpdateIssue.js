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

    issueInfo.id = undefined;
    issueInfo.status = undefined;

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
        const { status } = issue;

        if (!id) {
            throw new context.CancelError('Issue ID is required!');
        }

        const hasCustomFields = Object.keys(issue).some(key => key.startsWith('customfield_'));
        if (hasCustomFields) {
            try {
                const { fields } = await commons.get(
                    `${apiUrl}issue/createmeta/${project}/issuetypes/${issueType}`,
                    auth
                );
                if (fields) {
                    const fieldMeta = fields.reduce((acc, field) => {
                        acc[field.fieldId] = field;
                        return acc;
                    }, {});
                    commons.formatCustomFields(issue, fieldMeta);
                }
            } catch (e) {
                // If metadata fetch fails, custom fields will be passed as-is
            }
        }

        if (status) {
            await commons.post(
                `${apiUrl}issue/${id}/transitions`, auth,
                {
                    transition: {
                        id: status
                    }
                });
        }

        await commons.put(`${apiUrl}issue/${id}`, auth, buildIssue(issue));
        return context.sendJson({ id }, 'out');
    }
};
