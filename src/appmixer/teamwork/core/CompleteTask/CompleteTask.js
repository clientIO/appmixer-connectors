'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { taskId } = context.messages.in.content;

        await lib.callAPI(
            context, 
            "PUT",
            `/tasks/${taskId}/complete.json`,
            null,
        )

        context.sendJson({id: taskId}, 'task');
    }
}
