'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let { taskId, workflowId, workflowStageId } = context.messages.in.content;

        if (!workflowId || !workflowStageId) {
            throw new Error('Workflow ID and workflow stage ID are required');
        }

        await lib.callAPI(
            context,
            "PATCH",
            `/projects/api/v3/tasks/${taskId}/workflows/${workflowId}.json`,
            {
                "workflowId": workflowId,
                "stageId": workflowStageId,
                "positionAfterTask": 0,
            },
            null
        )

        context.sendJson({
            taskId: taskId,
            workflowId: workflowId,
            workflowStageId: workflowStageId,
        }, 'task');
    }
}
