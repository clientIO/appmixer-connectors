'use strict';

module.exports = {
    async receive(context) {
        const { channelId, max_age, max_uses, temporary, unique } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-channel-invite
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://discord.com/api/v10/channels/${channelId}/invites`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            data: {
                max_age,
                max_uses,
                temporary,
                unique
            }
        });

        return context.sendJson(data, 'out');
    }
};
