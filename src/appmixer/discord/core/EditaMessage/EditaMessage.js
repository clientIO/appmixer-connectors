
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, messageId, content, embeds, flags, allowed_mentions } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#edit-message
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://discord.com/api/v10/channels/${channelId}/messages/${messageId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
