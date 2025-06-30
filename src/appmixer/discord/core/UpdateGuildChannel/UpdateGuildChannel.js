'use strict';

module.exports = {
    async receive(context) {
        const { channelId, name, type, position, parentId, nsfw, rateLimitPerUser } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#modify-channel
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://discord.com/api/v10/channels/${channelId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            data: {
                name, type, rate_limit_per_user: rateLimitPerUser, position, parent_id: parentId, nsfw
            }
        });

        return context.sendJson(data, 'out');
    }
};
