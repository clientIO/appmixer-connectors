'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { 
            searchTerm, 
            startDate, 
            priority, 
            endDate, 
            orderMode, 
            orderBy, 
            page, 
            pageSize, 
            tasklistId,
            responsiblePartyIds,
            createdByUserIds,
            includeSubTasks,
            tagIds,
            customfields
        } = context.messages.in.content;
        let q = {}

        q.searchTerm = searchTerm;
        q.startDate = startDate;
        q.endDate = endDate;
        q.priority = priority;
        q.orderMode = orderMode;
        q.orderBy = orderBy;
        q.includeSubTasks = includeSubTasks;
        if (responsiblePartyIds) {
            q.responsiblePartyIds = responsiblePartyIds.join(',');
        }
        if (createdByUserIds){
            q.createdByUserIds = createdByUserIds.join(',');
        }
        if (tagIds) {
            q.tagIds = tagIds.join(',');
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

                q[`customField[${id}][eq]`] = cf.value;
            }
        }

        if (page > 0|| pageSize > 0) {
            q.page = page;
            q.pageSize = pageSize;

            let resp = await lib.callAPI(
                context,
                "GET",
                `/projects/api/v3/tasklists/${tasklistId}/tasks.json`,
                null,
                q,
            );

            return context.sendJson(resp, 'tasks');
        } else {
            let allTasks = [];
            let currentPage = 1;
            let hasMore = true;
            try {
                while (hasMore) {
                    q.page = currentPage;
                    q.pageSize = 500;

                    let resp = await lib.callAPI(
                        context,
                        "GET",
                        `/projects/api/v3/tasklists/${tasklistId}/tasks.json`,
                        null,
                        q,
                    );

                    if (resp && Array.isArray(resp.tasks)) {
                        allTasks = allTasks.concat(resp.tasks);
                    } else {
                        throw new Error('Invalid API response structure');
                    }

                    hasMore = resp.meta?.page?.hasMore || false;
                    currentPage++;
                }

                return context.sendJson({ tasks: allTasks }, 'tasks');
            } catch (error) {
                throw new Error(`Error fetching tasks: ${error.message}`);
            }
        }
    },

    toInspector: function(data){
        let transformed = [];
        if (data && Array.isArray(data.tasks)) {
            data.tasks.forEach(project => {
                transformed.push({
                    label: project.name,
                    value: project.id.toString()
                });
            });
        }

        return transformed;
    } 
}
