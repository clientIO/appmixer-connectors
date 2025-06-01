
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, name, avatar, reason, threadId, channelIdOverride, guildIdOverride } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/webhook#create-webhook
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/channels/${channelId}/webhooks',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
