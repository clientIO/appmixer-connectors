
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, messageId, emoji, reason } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-reaction
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: 'https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
