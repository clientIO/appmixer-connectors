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
            projectIds,
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
        q.page = page;
        q.pageSize = pageSize;
        q.includeSubTasks = includeSubTasks;
        if (projectIds) {
            q.projectIds = projectIds.join(',');
        }
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

        let resp = await lib.callAPI(
            context, 
            "GET",
            '/projects/api/v3/tasks.json',
            null,
            q,
        )

        return context.sendJson(resp, 'tasks');
    }
}
