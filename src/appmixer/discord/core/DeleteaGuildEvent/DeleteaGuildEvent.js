
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId, guildScheduledEventId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild-scheduled-event#delete-guild-scheduled-event
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${guildScheduledEventId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
