'use strict';

module.exports = {
    async receive(context) {
        const { userId, roleId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#add-guild-member-role
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/members/${userId}/roles/${roleId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
