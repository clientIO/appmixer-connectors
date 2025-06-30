'use strict';

module.exports = {
    async receive(context) {
        const { channelId, messageId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#delete-message
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
