
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId, name, type, topic, bitrate, user_limit, rate_limit_per_user, position, permission_overwrites, parent_id, nsfw } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#create-guild-channel
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/guilds/${guildId}/channels',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
