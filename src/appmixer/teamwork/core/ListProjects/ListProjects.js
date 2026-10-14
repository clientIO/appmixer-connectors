'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { 
          searchTerm, 
          companyIds, 
          customfields, 
          includeTentativeProjects,
        } = context.messages.in.content;
        let q = {}
        q.searchTerm = searchTerm;

        if (companyIds) {
            q.projectCompanyIds = companyIds.join(',');
        }

        if (includeTentativeProjects) {
            q.includeTentativeProjects = true;
        }

        // Add custom fields if they're set
        if (customfields?.AND?.length > 0) {
            for (let cf of customfields.AND) {
                let id = cf.name.split('-')[0];
                let type = cf.name.split('-')[1];

                if (type === 'number') {
                    if (!Number.isInteger(+cf.value)) {
                        throw new Error(`Invalid value "${cf.value}" for number custom field`);
                    }
                    cf.value = parseInt(cf.value, 10);
                }

                q[`projectCustomField[${id}][eq]`] = cf.value;
            }
        }

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
                    '/projects/api/v3/projects.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.projects)) {
                    allProjects = allProjects.concat(resp.projects);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching projects: ${error.message}`);
        }

        return context.sendJson({ projects: allProjects }, 'projects');
    },

    toInspector: function(data){
        let transformed = [];
        if (data && Array.isArray(data.projects)) {
            data.projects.forEach(project => {
                transformed.push({
                    label: project.name,
                    value: project.id.toString()
                });
            });
        }

        return transformed;
    }
}
