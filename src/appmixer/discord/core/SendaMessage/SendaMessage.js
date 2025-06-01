
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, content, tts, embeds, allowed_mentions, message_reference, components, sticker_ids, flags } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#create-message
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://discord.com/api/v10/channels/${channelId}/messages',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
