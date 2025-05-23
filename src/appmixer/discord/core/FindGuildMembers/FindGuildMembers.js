
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild#list-guild-members
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://discord.com/api/v10/guilds/${guildId}/members',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
