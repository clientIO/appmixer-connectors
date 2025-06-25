
'use strict';

const lib = require('../lib.generated');
module.exports = {
    async receive(context) {

        const { tasklistId, title, notes, due } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest/v1/tasks/insert
        const { data } = await context.httpRequest({
            method: 'POST',
            url: '/tasks/v1/lists/{tasklistId}/tasks',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
