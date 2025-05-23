
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#get-channel-invites
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://discord.com/api/v10/channels/${channelId}/invites',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
