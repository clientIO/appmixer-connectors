
'use strict';

const lib = require('../lib.generated');
module.exports = {
    async receive(context) {

        const { tasklistId, taskId } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest/v1/tasks/get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: '/tasks/v1/lists/{tasklistId}/tasks/{taskId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
