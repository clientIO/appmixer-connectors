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
            maxResults: 100,
            jql: `updated > ${updatedTime}`,
            fields: '*navigable'
        };

        if (project) {
            params.jql += ` AND project = "${project}"`;
        }

        params.jql += ' ORDER BY updated ASC';

        const issues = await commons.getAPINoPagination({
            endpoint: `${apiUrl}search/jql`,
            credentials: auth,
            key: 'issues',
            params
        });

        let latestIssueUpdateDate;
        if (Array.isArray(issues) && issues.length > 0) {
            const issuesFiltered = issues.filter(i => {
                return (new Date(i.fields.updated).valueOf() - new Date(i.fields.created).valueOf()) > 59000;
            });
            if (issuesFiltered.length > 0) {
                const latestIssueIndex = issuesFiltered.length - 1;
                latestIssueUpdateDate = new Date(issuesFiltered[latestIssueIndex].fields.updated).valueOf();
                for (const issue of issuesFiltered) {
                    await context.sendJson(issue, 'issue');
                }
            }
        }

        return context.saveState({ updatedTime: latestIssueUpdateDate ?? now });
    },

    async test(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { project } = context.properties;

        // Newest updated issues first (no `updated > now` baseline), via the same
        // search request and fields tick() uses.
        let jql = project ? `project = "${project}" ` : '';
        jql += 'ORDER BY updated DESC';

        const issues = await commons.getAPINoPagination({
            endpoint: `${apiUrl}search/jql`,
            credentials: auth,
            key: 'issues',
            params: { maxResults: 100, jql, fields: '*navigable' }
        });

        // Same "actually updated, not just created" filter as tick().
        const updated = (issues || []).find(i => {
            return (new Date(i.fields.updated).valueOf() - new Date(i.fields.created).valueOf()) > 59000;
        });

        if (!updated) {
            throw new Error('No recently updated issues to use as test data.');
        }
        return context.sendJson(updated, 'issue');
    }
};
