'use strict';

module.exports = {
    async receive(context) {
        const { name, type, rateLimitPerUser, position, parentId, nsfw } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#create-guild-channel
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/channels`,
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
