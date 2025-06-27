'use strict';

module.exports = {
    async receive(context) {
        const { guildScheduledEventId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/guild-scheduled-event#delete-guild-scheduled-event
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/scheduled-events/${guildScheduledEventId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
