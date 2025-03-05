'use strict';

const commons = require('../../jira-commons');

const excludeFields = ['components', 'issuetype', 'attachment', 'issuelinks', 'project'];

function createMetaToInspector(fields) {

    return commons.toInspector(fields, excludeFields);
}

function updateMetaToInspector(fields) {

    const inspector = commons.toInspector(fields, excludeFields, 2);

    inspector.schema.properties['id'] = { type: 'string' };
    inspector.schema.properties['status'] = { type: 'string' };
    inspector.schema.required = ['id'];
    inspector.inputs.id = {
        label: 'Issue Key or ID',
        type: 'text',
        tooltip: 'The Key or ID of the issue',
        index: 0
    };

    inspector.inputs.status = {
        label: 'Status',
        type: 'text',
        tooltip: 'We can only provide the available statuses for the issue mentioned in the above field (Issue Key or ID).',
        index: 1,
        source: {
            url: '/component/appmixer/jira/issues/GetIssueTransitions?outPort=out',
            data: {
                messages: {
                    'in/id': 'inputs/in/id'
                },
                transform: './GetIssueTransitions#transitionsToSelectArray'
            }
        }
    };

    return inspector;
}

module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;

        let { project, issueType } = context.messages.in.content;

        if (!project) {
            const projects = await commons.pager({
                endpoint: `${apiUrl}project/search`,
                credentials: auth,
                key: 'values',
                params: { maxResults: 100 }
            });

            return context.sendJson(projects, 'out');
        }

        if (!issueType) {
            const { issueTypes } = await commons.get(
                `${apiUrl}issue/createmeta/${project}/issuetypes`,
                auth
            );

            return context.sendJson(issueTypes || [], 'out');
        }

        const { fields } = await commons.get(
            `${apiUrl}issue/createmeta/${project}/issuetypes/${issueType}`,
            auth
        );

        if (!fields) {
            return context.sendJson([], 'out');
        }

        const fieldsModified = fields.reduce((acc, field) => {
            const { fieldId, ...rest } = field;
            acc[fieldId] = rest;
            return acc;
        }, {});

        return context.sendJson(fieldsModified, 'out');
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
