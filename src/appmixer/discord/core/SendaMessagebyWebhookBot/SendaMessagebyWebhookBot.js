
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { webhookId, webhookToken, content, username, avatar_url, tts, embeds, allowed_mentions, components, threadId, flags } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/webhook#execute-webhook
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
