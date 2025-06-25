
'use strict';

const lib = require('../lib.generated');
module.exports = {
    async receive(context) {

        const { method, endpoint, queryParams, body } = context.messages.in.content;

        // https://developers.google.com/tasks/reference/rest
        const { data } = await context.httpRequest({
            method: 'GET',
            url: '',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
