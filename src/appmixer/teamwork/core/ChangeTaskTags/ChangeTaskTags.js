'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let { taskId, operation, tagIds } = context.messages.in.content;

        let q = {};

        let updatedTagIds;
        let replaceExistingTags = true;

        let resp = await lib.callAPI(
            context,
            "GET",
            `/projects/api/v3/tasks/${taskId}.json`,
            null,
            q,
        )

        if (!resp.task) {
            throw new Error(`Task not found`);
        }

        const taskTagIds = resp.task.tagIds;

        switch (operation) {
            case 'add':
                updatedTagIds = [].concat(taskTagIds || [], tagIds);
                replaceExistingTags = false;
                break;
            case 'replace':
                updatedTagIds = tagIds;
                break;
            case 'remove':
                updatedTagIds = (taskTagIds || [])
                    .filter((tagId) => tagIds.includes(tagId.toString()) === false);
                break;
            case 'removeAllTags':
                updatedTagIds = [];
                break;
            default:
                throw new Error(`Unsupported ChangeTaskTags operation: ${operation}`);
        }

        await lib.callAPI(
            context,
            "PUT",
            `/tasks/${taskId}/tags.json`,
            {
                "tagIds": updatedTagIds.join(',')
            },
            { replaceExistingTags: replaceExistingTags }
        )

        context.sendJson({
            taskId: taskId,
            tagIds: updatedTagIds,
            operation: operation,
        }, 'task');
    }
}
