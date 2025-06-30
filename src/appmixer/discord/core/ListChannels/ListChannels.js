'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;
        const { generateOutputPortOptions, isSource } = context.properties;
        const { auth } = context;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Channels', value: 'result' });
        }

        const cacheKey = 'discord_channels_' + auth.accessToken.slice(5, -5);
        let lock;
        try {
            lock = await context.lock(auth.accessToken.slice(5, -5));

            if (isSource) {
                const channelsCached = await context.staticCache.get(cacheKey);
                if (channelsCached) {
                    return context.sendJson({ result: channelsCached }, 'out');
                }
            }

            // https://discord.com/developers/docs/resources/guild#get-guild-channels
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://discord.com/api/v10/guilds/${auth.profileInfo.guildId}/channels`,
                headers: {
                    'Authorization': `Bot ${auth.botToken}`
                }
            });

            if (!Array.isArray(data) || !data.length) {
                return context.sendJson({}, 'notFound');
            }

            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    data.map(channel => ({ id: channel.id, name: channel.name })),
                    context.config.listChannelsCacheTTL || (20 * 1000)
                );

                return context.sendJson({ result: data }, 'out');
            }

            await lib.sendArrayOutput({ context, records: data, outputType });
        } finally {
            lock?.unlock();
        }
    },

    toSelectArray({ result }) {

        return result.map(channel => {
            return { label: channel.name, value: channel.id };
        });
    }
};

const schema = {
    'id': { 'type': 'string', 'title': 'Channel ID' },
    'type': { 'type': 'number', 'title': 'Type' },
    'last_message_id': { 'type': 'string', 'title': 'Last Message ID' },
    'flags': { 'type': 'number', 'title': 'Flags' },
    'guild_id': { 'type': 'string', 'title': 'Guild ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'parent_id': { 'type': 'string', 'title': 'Parent ID' },
    'rate_limit_per_user': { 'type': 'number', 'title': 'Rate Limit Per User' },
    'bitrate': { 'type': 'number', 'title': 'Bitrate' },
    'user_limit': { 'type': 'number', 'title': 'User Limit' },
    'rtc_region': { 'type': 'string', 'title': 'Rtc Region' },
    'position': { 'type': 'number', 'title': 'Position' },
    'permission_overwrites': { 'type': 'array', 'items': {}, 'title': 'Permission Overwrites' },
    'nsfw': { 'type': 'boolean', 'title': 'NSFW' },
    'icon_emoji': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'Icon Emoji.ID' },
            'name': { 'type': 'string', 'title': 'Icon Emoji.Name' }
        }, 'title': 'Icon Emoji'
    }, 'theme_color': { 'type': 'string', 'title': 'Theme Color' },
    'voice_background_display': { 'type': 'string', 'title': 'Voice Background Display' }
};
