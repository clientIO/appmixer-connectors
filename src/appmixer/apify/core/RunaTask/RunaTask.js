
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { taskId, body } = context.messages.in.content;

        // https://docs.apify.com/api/v2#/reference/actor-tasks/run-task/run-task
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.apify.com/v2/actor-tasks/{taskId}/runs',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
