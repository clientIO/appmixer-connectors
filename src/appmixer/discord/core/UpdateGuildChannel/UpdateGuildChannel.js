'use strict';

module.exports = {
    async receive(context) {
        const { channelId, name, type, position, topic, nsfw, rate_limit_per_user } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#modify-channel
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://discord.com/api/v10/channels/${channelId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            data: {
                name, type, topic, rate_limit_per_user, position, parent_id, nsfw
            }
        });

        return context.sendJson(data, 'out');
    }
};
