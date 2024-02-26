'use strict';
const commons = require('../../jira-commons');

module.exports = {

    async tick(context) {

        const { profileInfo: { apiUrl }, auth } = context;

        const projects = await commons.pager({
            endpoint: `${apiUrl}project/search`,
            credentials: auth,
            key: 'values',
            params: { maxResults: 100 }
        });

        const { savedProjects } = await context.loadState();

        let known = Array.isArray(savedProjects) ? new Set(savedProjects) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(projects)) {
            projects.forEach(commons.processItems.bind(null, known, actual, diff));
        }

        if (diff.size) {
            const promises = [];
            diff.forEach(project => {
                promises.push(context.sendJson(project, 'project'));
            });
            await Promise.all(promises);
        }

        return context.saveState({ savedProjects: Array.from(actual) });
    }
};
