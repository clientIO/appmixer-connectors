'use strict';

module.exports = {
    async receive(context) {
        const { channelId, threadId, content } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-message
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://discord.com/api/v10/channels/${channelId ?? threadId}/messages`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            data: { content }
        });

        return context.sendJson(data, 'out');
    }
};
