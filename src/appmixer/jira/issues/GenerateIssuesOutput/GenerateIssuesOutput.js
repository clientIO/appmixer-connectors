'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { sendWholeArray = false, isWebhook = false } = context.properties;
        return context.sendJson({ sendWholeArray, isWebhook }, 'out');
    },

    getOutputOptions({ sendWholeArray, isWebhook }) {
        if (sendWholeArray) {
            return [{ label: 'Issues', value: 'issues' }];
        } else {
            const output = [
                { label: 'Issue ID', value: 'id' },
                { label: 'Issue Key', value: 'key' },
                { label: 'Issue Type', value: 'fields.issuetype' },
                { label: 'Issue Type ID', value: 'fields.issuetype.id' },
                { label: 'Issue Type Name', value: 'fields.issuetype.name' },
                { label: 'Project', value: 'fields.project' },
                { label: 'Project ID', value: 'fields.project.id' },
                { label: 'Project Name', value: 'fields.project.name' },
                { label: 'Resolution', value: 'fields.resolution' },
                { label: 'Resolution Date', value: 'fields.resolutiondate' },
                { label: 'Work Ratio', value: 'fields.workratio' },
                { label: 'Created', value: 'fields.created' },
                { label: 'Priority', value: 'fields.priority' },
                { label: 'Priority ID', value: 'fields.priority.id' },
                { label: 'Priority Name', value: 'fields.priority.name' },
                { label: 'Labels', value: 'fields.labels' },
                { label: 'Estimated Time', value: 'fields.timeestimate' },
                { label: 'Versions', value: 'fields.versions' },
                { label: 'Issue Links', value: 'fields.issuelinks' },
                { label: 'Assignee', value: 'fields.assignee' },
                { label: 'Updated', value: 'fields.updated' },
                { label: 'Status', value: 'fields.status' },
                { label: 'Status ID', value: 'fields.status.id' },
                { label: 'Status Name', value: 'fields.status.name' },
                { label: 'Components', value: 'fields.components' },
                { label: 'Estimated Original Time', value: 'fields.timeoriginalestimate' },
                { label: 'Description', value: 'fields.description' },
                { label: 'Description Version', value: 'fields.description.version' },
                { label: 'Description Type', value: 'fields.description.type' },
                { label: 'Description Content', value: 'fields.description.content' },
                { label: 'Security', value: 'fields.security' },
                { label: 'Summary', value: 'fields.summary' },
                { label: 'Creator', value: 'fields.creator' },
                { label: 'Creator ID', value: 'fields.creator.id' },
                { label: 'Creator Name', value: 'fields.creator.name' },
                { label: 'Creator Key', value: 'fields.creator.key' },
                { label: 'Creator Account ID', value: 'fields.creator.accountId' },
                { label: 'Creator Email', value: 'fields.creator.emailAddress' },
                { label: 'Creator Display Name', value: 'fields.creator.displayName' },
                { label: 'Creator isActive?', value: 'fields.creator.active' },
                { label: 'Subtasks', value: 'fields.subtasks' },
                { label: 'Reporter', value: 'fields.reporter' },
                { label: 'Reporter ID', value: 'fields.reporter.id' },
                { label: 'Reporter Name', value: 'fields.reporter.name' },
                { label: 'Reporter Key', value: 'fields.reporter.key' },
                { label: 'Reporter Account ID', value: 'fields.reporter.accountId' },
                { label: 'Reporter Email', value: 'fields.reporter.emailAddress' },
                { label: 'Reporter Display Name', value: 'fields.reporter.displayName' },
                { label: 'Reporter isActive', value: 'fields.reporter.active' },
                { label: 'Environment', value: 'fields.environment' },
                { label: 'Due Date', value: 'fields.duedate' },
                { label: 'Progress', value: 'fields.progress' },
                { label: 'Progress progress', value: 'fields.progress.progress' },
                { label: 'Progress Total', value: 'fields.progress.total' },
                { label: 'Fields', value: 'fields' }
            ];

            if (isWebhook) {
                output.push({ label: 'Webhook Event', value: 'webhookEvent' });
            }

            return output;
        }
    }
};
