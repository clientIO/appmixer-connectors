
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { guildId, guildScheduledEventId, name, privacy_level, scheduled_start_time, scheduled_end_time, description, entity_type, entityId, channelId, location, status, image } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild-scheduled-event#modify-guild-scheduled-event
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://discord.com/api/v10/guilds/${guildId}/scheduled-events/${guildScheduledEventId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
