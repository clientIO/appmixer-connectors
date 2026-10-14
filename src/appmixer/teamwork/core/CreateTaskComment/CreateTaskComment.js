'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { taskId, body } = context.messages.in.content;

        await lib.callAPI(
            context, 
            "POST",
            `/tasks/${taskId}/comments.json`,
            {
                "comment":{
                    "body":body,
                    "content-type":"text",
                }
            },
        )

        context.sendJson({
            taskId: taskId,
            body: body
        }, 'task');
    }
}
