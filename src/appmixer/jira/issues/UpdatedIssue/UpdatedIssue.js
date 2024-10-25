'use strict';
const commons = require('../../jira-commons');

/**
 * Component which triggers whenever an issue is updated.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { project } = context.properties;

        let { updatedTime } = await context.loadState();

        const now = Date.now();

        if (!updatedTime) {
            updatedTime = now;
        }

        const params = {
            maxResults: 1000,
            jql: `updated > ${updatedTime}`
        };

        if (project) {
            params.jql += ` AND project = "${project}"`;
        }

        params.jql += ' ORDER BY updated ASC';

        const issues = await commons.getAPINoPagination({
            endpoint: `${apiUrl}search`,
            credentials: auth,
            key: 'issues',
            params
        });

        let latestIssueUpdateDate;
        if (Array.isArray(issues) && issues.length > 0) {
            const issuesFiltered = issues.filter(i => {
                return (new Date(i.fields.updated).valueOf() - new Date(i.fields.created).valueOf()) > 1000;
            });
            const latestIssueIndex = issuesFiltered.length - 1;
            latestIssueUpdateDate = new Date(issuesFiltered[latestIssueIndex].fields.updated).valueOf();
            for (const issue of issuesFiltered) {
                await context.sendJson(issue, 'issue');
            }
        }

        return context.saveState({ updatedTime: latestIssueUpdateDate ?? now });
    }
};
