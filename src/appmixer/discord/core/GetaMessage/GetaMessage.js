
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, messageId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#get-channel-message
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://discord.com/api/v10/channels/${channelId}/messages/${messageId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
