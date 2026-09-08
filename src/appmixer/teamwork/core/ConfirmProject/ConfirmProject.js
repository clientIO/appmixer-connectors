'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { projectId } = context.messages.in.content;

        await lib.callAPI(
            context, 
            "PUT",
            `/projects/api/v3/projects/tentative/${projectId}/convert.json`,
            null,
        )

        context.sendJson({id: projectId}, 'project');
    }
}
