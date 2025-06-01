
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId, userId, roleId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#remove-guild-member-role
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
