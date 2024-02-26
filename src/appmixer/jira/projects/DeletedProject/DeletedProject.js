'use strict';
const commons = require('../../jira-commons');

function processProjects(projects, deletedProjects, project) {

    const found = projects.find(({ id }) => id === project.id);
    if (!found) {
        deletedProjects.add(project);
    }
}

/**
 * @extends {Component}
 */
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
        let diff = new Set();
        if (Array.isArray(savedProjects)) {
            savedProjects.forEach(processProjects.bind(null, projects, diff));
        }

        if (diff.size) {
            const promises = [];
            diff.forEach(project => {
                promises.push(context.sendJson(project, 'deleted'));
            });
            await Promise.all(promises);
        }

        return context.saveState({ savedProjects: projects });
    }
};
