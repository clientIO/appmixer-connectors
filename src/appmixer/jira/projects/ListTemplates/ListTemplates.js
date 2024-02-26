'use strict';

const TEMPLATES = {
    business: [{
        label: 'Content Management',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-content-management'
    }, {
        label: 'Document Approval',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-document-approval'
    }, {
        label: 'Lead Tracking',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-lead-tracking'
    }, {
        label: 'Process Control',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-process-control'
    }, {
        label: 'Procurement',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-procurement'
    }, {
        label: 'Project Management',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-project-management'
    }, {
        label: 'Recruitment',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-recruitment'
    }, {
        label: 'Task Tracking',
        value: 'com.atlassian.jira-core-project-templates:jira-core-simplified-task-tracking'
    }],
    service_desk: [{
        label: 'IT Service Desk',
        value: 'com.atlassian.servicedesk:simplified-it-service-desk'
    }, {
        label: 'Internal Service Desk',
        value: 'com.atlassian.servicedesk:simplified-internal-service-desk'
    }, {
        label: 'External Service Desk',
        value: 'com.atlassian.servicedesk:simplified-external-service-desk'
    }],
    software: [{
        label: 'Agility Kanban',
        value: 'com.pyxis.greenhopper.jira:gh-simplified-agility-kanban'
    }, {
        label: 'Agility Scrum',
        value: 'com.pyxis.greenhopper.jira:gh-simplified-agility-scrum'
    }, {
        label: 'Basic',
        value: 'com.pyxis.greenhopper.jira:gh-simplified-basic'
    }, {
        label: 'Kanban Classic',
        value: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic'
    }, {
        label: 'Scrum Procurement',
        value: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic'
    }]
};

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { projectType } = context.properties;

        const templates = TEMPLATES[projectType];
        return context.sendJson(templates, 'templates');
    }
};
