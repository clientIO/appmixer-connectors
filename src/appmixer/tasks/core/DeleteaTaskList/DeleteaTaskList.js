
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { tasklistId } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest/v1/tasklists/delete
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: '/tasks/v1/tasklists/{tasklistId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
