'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { channelId, threadId, messageId, emojiId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Members', value: 'result' });
        }

        // https://discord.com/developers/docs/resources/message#get-reactions
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://discord.com/api/v10/channels/${channelId ?? threadId}/messages/${messageId}/reactions/${emojiId}`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        if (!Array.isArray(data) || !data.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};

const schema = {
    'id': { 'type': 'string', 'title': 'Guild Member ID' },
    'username': { 'type': 'string', 'title': 'Username' },
    'avatar': { 'type': 'string', 'title': 'Avatar' },
    'discriminator': { 'type': 'string', 'title': 'Discriminator' },
    'public_flags': { 'type': 'number', 'title': 'Public Flags' },
    'flags': { 'type': 'number', 'title': 'Flags' },
    'banner': { 'type': 'string', 'title': 'Banner' },
    'accent_color': { 'type': 'string', 'title': 'Accent Color' },
    'global_name': { 'type': 'string', 'title': 'Global Name' },
    'avatar_decoration_data': { 'type': 'string', 'title': 'Avatar Decoration Data' },
    'collectibles': { 'type': 'string', 'title': 'Collectibles' },
    'banner_color': { 'type': 'string', 'title': 'Banner Color' },
    'clan': { 'type': 'string', 'title': 'Clan' },
    'primary_guild': { 'type': 'string', 'title': 'Primary Guild' }
};
