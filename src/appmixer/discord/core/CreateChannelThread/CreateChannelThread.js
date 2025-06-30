'use strict';

module.exports = {
    async receive(context) {
        const { channelId, name } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-channel-thread
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://discord.com/api/v10/channels/${channelId}/threads`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            data: {
                name
            }
        });

        return context.sendJson(data, 'out');
    }
};
