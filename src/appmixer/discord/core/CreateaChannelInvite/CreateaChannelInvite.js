
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, max_age, max_uses, temporary, unique, target_type, target_user_id, target_application_id } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-channel-invite
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/channels/${channelId}/invites',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
