'use strict';

module.exports = {
    async receive(context) {
        const { channelId, threadId, messageId, content } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#edit-message
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://discord.com/api/v10/channels/${channelId ?? threadId}/messages/${messageId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
