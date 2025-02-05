'use strict';

const commons = require('../../jira-commons');

const excludeFields = ['components', 'issuetype', 'attachment', 'issuelinks', 'project'];

function createMetaToInspector(fields) {

    return commons.toInspector(fields, excludeFields);
}

function createIssueMetaToInspector(fields) {
    const inspector = {
        schema: {
            type: 'object',
            properties: {},
            required: []
        },
        inputs: {
        }
    };

    Object.keys(fields).forEach((key, index) => {
        if (excludeFields.includes(key) || key.includes('customfield_')) {
            return;
        }

        const { name, schema, required, allowedValues, autoCompleteUrl, projectId } = fields[key];
        inspector.schema.properties[key] = {
            type: 'string'
        };

        if (required) {
            inspector.schema.required.push(key);
        }

        inspector.inputs[key] = {
            label: name,
            type: 'text',
            index: index + 1
        };

        if (Array.isArray(allowedValues)) {
            inspector.inputs[key].type = 'select';
            inspector.inputs[key].options = allowedValues.map(value => ({ content: value.name, value: value.id }));
        }

        if (schema.type === 'array') {
            inspector.schema.properties[key] = {
                type: 'array',
                items: {
                    type: 'string'
                }
            };

            inspector.inputs[key].type = 'multiselect';
        }

        if (schema.type === 'date') {
            inspector.inputs[key].type = 'date-time';
        }

        if (autoCompleteUrl) {
            inspector.inputs[key].source = {
                url: '/component/appmixer/jira/issues/ListField?outPort=out',
                data: {
                    messages: { in: { 'endpoint': '/rest/api/3/user/assignable/search', projectId } },
                    transform: './ListField#fieldToSelectArray'
                }
            };
        }
    });

    return inspector;
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

        const fieldsObj = type.fields;
        fieldsObj.projectId = project;

        return context.sendJson(fieldsObj, 'out');
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
    updateMetaToInspector,
    createIssueMetaToInspector
};
