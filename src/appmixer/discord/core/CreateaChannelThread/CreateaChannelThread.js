
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, name, auto_archive_duration, type, invitable, rate_limit_per_user, messageId, applied_tags } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-channel-thread
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/channels/${channelId}/threads',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
