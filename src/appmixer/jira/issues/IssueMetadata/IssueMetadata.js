'use strict';

const commons = require('../../jira-commons');

const excludeFields = ['components', 'issuetype', 'attachment', 'issuelinks', 'project'];

function createMetaToInspector(fields) {

    return commons.toInspector(fields, excludeFields);
}

function updateMetaToInspector(fields) {

    const inspector = commons.toInspector(fields, excludeFields);
    inspector.schema.properties['id'] = { type: 'string' };
    inspector.schema.required = ['id'];
    inspector.inputs.id = {
        label: 'Issue Key or ID',
        type: 'text',
        tooltip: 'The Key or ID of the issue',
        index: 0
    };

    return inspector;
}

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const metadata = await commons.get(
            `${apiUrl}issue/createmeta`,
            auth,
            { expand: 'projects.issuetypes.fields' }
        );

        let { project, issueType } = context.messages.in.content;

        if (!project) {
            return context.sendJson(metadata.projects, 'out');
        }

        const projectMetadata = metadata.projects.find(p => p.id === project);
        if (!projectMetadata) {
            return context.sendJson([], 'out');
        }

        if (!issueType) {
            return context.sendJson(projectMetadata.issuetypes || [], 'out');
        }

        const type = projectMetadata.issuetypes.find(it => it.id === issueType);
        if (!type) {
            return context.sendJson([], 'out');
        }

        return context.sendJson(type.fields, 'out');
    },

    projectsToSelectArray(projects) {

        if (Array.isArray(projects)) {
            return projects.map(p => ({ label: p.name, value: p.id }));
        }

        return [];
    },

    issueTypesToSelectArray(issueTypes) {

        if (Array.isArray(issueTypes)) {
            return issueTypes.map(it => ({ content: it.name, value: it.id }));
        }

        return [];
    },

    createMetaToInspector,
    updateMetaToInspector
};
