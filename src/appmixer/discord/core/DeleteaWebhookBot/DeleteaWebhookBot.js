
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { webhookId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/webhook#delete-webhook
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://discord.com/api/v10/webhooks/${webhookId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
