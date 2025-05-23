
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId, userId, nick, roles, mute, deaf, channel_id, communication_disabled_until, flags } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#modify-guild-member
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://discord.com/api/v10/guilds/${guildId}/members/${userId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
