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
            maxResults: 1000,
            jql: `created > ${createdTime}`
        };

        if (project) {
            params.jql += ` AND project = "${project}"`;
        }

        params.jql += ' ORDER BY created ASC';

        const issues = await commons.getAPINoPagination({
            endpoint: `${apiUrl}search`,
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
    }
};
