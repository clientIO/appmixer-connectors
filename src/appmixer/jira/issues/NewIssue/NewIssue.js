'use strict';
const commons = require('../../jira-commons');

/**
 * Component which triggers whenever a new issue is created.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { project } = context.properties;

        let { createdTime } = await context.loadState();

        const now = Date.now();

        if (!createdTime) {
            createdTime = now;
        }

        const params = {
            maxResults: 100,
            jql: `created > ${createdTime}`,
            fields: '*navigable'
        };

        if (project) {
            params.jql += ` AND project = "${project}"`;
        }

        params.jql += ' ORDER BY created ASC';

        const issues = await commons.getAPINoPagination({
            endpoint: `${apiUrl}search/jql`,
            credentials: auth,
            key: 'issues',
            params
        });

        let latestIssueCreateDate;
        if (Array.isArray(issues) && issues.length > 0) {
            const latestIssueIndex = issues.length - 1;
            latestIssueCreateDate = new Date(issues[latestIssueIndex].fields.created).valueOf();
            for (const issue of issues) {
                await context.sendJson(issue, 'issue');
            }
        }

        return context.saveState({ createdTime: latestIssueCreateDate ?? now });
    },

    async test(context) {

        // Newest issue first (no `created > now` baseline that suppresses output on a
        // fresh flow), honoring the same project filter as tick().
        const issue = await commons.fetchLatestIssue(context, {
            project: context.properties.project,
            orderBy: 'created'
        });
        if (!issue) {
            throw new Error('No recent issues to use as test data.');
        }
        return context.sendJson(issue, 'issue');
    }
};
