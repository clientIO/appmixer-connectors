'use strict';

module.exports = {
    async receive(context) {
        const { channelId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#deleteclose-channel
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://discord.com/api/v10/channels/${channelId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
