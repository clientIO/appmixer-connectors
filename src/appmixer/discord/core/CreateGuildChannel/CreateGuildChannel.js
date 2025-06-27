'use strict';

module.exports = {
    async receive(context) {
        const { name, type, topic, rate_limit_per_user, position, parent_id, nsfw } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#create-guild-channel
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/channels`,
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
