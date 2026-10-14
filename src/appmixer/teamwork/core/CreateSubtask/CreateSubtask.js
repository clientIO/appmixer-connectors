'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let {
            name, 
            description, 
            tasklistId,
            assignees,
            priority,
            startDate,
            endDate,
            estimatedMinutes,
            tagIds,
            customfields,
            parentTaskId
        } = context.messages.in.content;

        if (!assignees) {
            assignees = [];
        }

        if (!tagIds) {
            tagIds = [];
        }

        let body = {
            "task":{
                "name":name,
                "description":description,
                "tasklistId":tasklistId,
                "assignees":{
                    "userIds":assignees
                },
                "priority":priority,
                "startAt":startDate,
                "dueAt":endDate,
                "tagIds":tagIds,
                "estimatedMinutes":estimatedMinutes,
                "parentTaskId": Number(parentTaskId),
            }
        }

        // Add custom fields if they're set
        if (customfields?.AND?.length > 0) {
            let sanitizedCustomFields = [];
            for (let cf of customfields.AND) {
                let id = cf.name.split('-')[0];
                let type = cf.name.split('-')[1];

                if (type === 'number') {
                    if (!Number.isInteger(+cf.value)) {
                        throw new Error(`Invalid value "${cf.value}" for number custom field`);
                    }
                    cf.value = parseInt(cf.value, 10);
                }
                sanitizedCustomFields.push({
                    "customfieldId": Number(id),
                    "value": cf.value
                })
            }

            body.task.customfields = sanitizedCustomFields
        }


        let resp = await lib.callAPI(
            context, 
            "POST",
            `/projects/api/v3/tasklists/${tasklistId}/tasks.json`,
            body,
            null
        )

        context.sendJson(resp, 'task');
    }
}
