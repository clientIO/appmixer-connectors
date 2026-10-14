'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let {
            searchTerm,
        } = context.messages.in.content;
        let q = {
            include: ['projects']
        }
        q.searchTerm = searchTerm;

        let allWorkflows = [];
        let allProjects = [];
        let page = 1;
        let pageSize = 500;
        let hasMore = true;
        try {
            while (hasMore) {
                q.page = page;
                q.pageSize = pageSize;

                let resp = await lib.callAPI(
                    context,
                    "GET",
                    '/projects/api/v3/workflows.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.workflows)) {
                    allWorkflows = allWorkflows.concat(resp.workflows);
                    if (resp.included?.projects) {
                        allProjects = allProjects.concat(resp.included.projects);
                    }
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching workflows: ${error.message}`);
        }

        return context.sendJson({ workflows: allWorkflows, projects: allProjects }, 'workflows');
    },

    toInspector: function (data) {
        let transformed = [];
        // Convert { 'projectId1': {...}, 'projectId2': {...} } to [ {...}, {...} ]
        const projectsRaw = data.projects;
        let projectsArray;
        if (Array.isArray(projectsRaw)) {
            const first = projectsRaw[0];
            const isSingleKeyedObject = projectsRaw.length === 1 && first && typeof first === 'object' && !Array.isArray(first) && first.id == null;
            projectsArray = isSingleKeyedObject ? Object.values(first) : projectsRaw;
        } else if (projectsRaw && typeof projectsRaw === 'object') {
            projectsArray = Object.values(projectsRaw);
        } else {
            projectsArray = [];
        }
        if (data && Array.isArray(data.workflows)) {
            data.workflows.forEach(workflow => {
                const length = workflow.projectIds ? workflow.projectIds.length : 0;
                let label = `${workflow.name} - (${length} ${length === 1 ? 'project' : 'projects'})`;
                if (workflow.projectSpecific && workflow.projectIds && workflow.projectIds.length > 0) {
                    const firstProjectId = workflow.projectIds[0];
                    const workflowProject = projectsArray.find(project => parseInt(project.id, 10) === parseInt(firstProjectId, 10));
                    if (workflowProject && workflowProject.name) {
                        label = `${workflowProject.name} - (Project specific)`;
                    }
                }
                transformed.push({
                    label,
                    value: workflow.id.toString()
                });
            });
        }

        return transformed;
    }
}
