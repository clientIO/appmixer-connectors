
'use strict';

const lib = require('../lib.generated');
module.exports = {
    async receive(context) {

        const { tasklistId, taskId, title, notes, status, due } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest/v1/tasks/patch
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: '/tasks/v1/lists/{tasklistId}/tasks/{taskId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
