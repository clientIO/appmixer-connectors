'use strict';
const moment = require('moment');
const commons = require('../../jira-commons');

module.exports = {

    async tick(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const { project } = context.properties;

        let { createdTime } = await context.loadState();
        const current = moment().utc().format('YYYY-MM-DD HH:mm');

        if (!createdTime) {
            createdTime = current;
        }

        const params = {
            maxResults: 100,
            jql: `created >= "${createdTime}"`
        };

        if (project) {
            params.jql += ` AND project = "${project}"`;
        }

        const issues = await commons.pager({
            endpoint: `${apiUrl}search`,
            credentials: auth,
            key: 'issues',
            params
        });

        if (Array.isArray(issues) && issues.length > 0) {
            const promises = [];
            issues.forEach(issue => {
                promises.push(context.sendJson(issue, 'issue'));
            });
            await Promise.all(promises);
        }

        return context.saveState({ createdTime: current });
    }
};
