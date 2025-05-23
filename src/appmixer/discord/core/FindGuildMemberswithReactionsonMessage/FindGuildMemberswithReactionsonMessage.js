
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, messageId, emoji } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/reaction#get-reactions
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emoji}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
