
'use strict';

const lib = require('../lib.generated');
module.exports = {
    async receive(context) {

        const { title } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest/v1/tasklists/insert
        const { data } = await context.httpRequest({
            method: 'POST',
            url: '/tasks/v1/users/@me/lists',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
