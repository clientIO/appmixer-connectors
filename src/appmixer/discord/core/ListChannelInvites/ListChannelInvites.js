'use strict';

const lib = require('../../lib.generated');
const schema = { 'id': { 'type': 'string', 'title': 'Id' }, 'type': { 'type': 'number', 'title': 'Type' }, 'last_message_id': { 'type': 'null', 'title': 'Last Message Id' }, 'flags': { 'type': 'number', 'title': 'Flags' }, 'guild_id': { 'type': 'string', 'title': 'Guild Id' }, 'name': { 'type': 'string', 'title': 'Name' }, 'parent_id': { 'type': 'string', 'title': 'Parent Id' }, 'rate_limit_per_user': { 'type': 'number', 'title': 'Rate Limit Per User' }, 'bitrate': { 'type': 'number', 'title': 'Bitrate' }, 'user_limit': { 'type': 'number', 'title': 'User Limit' }, 'rtc_region': { 'type': 'null', 'title': 'Rtc Region' }, 'position': { 'type': 'number', 'title': 'Position' }, 'permission_overwrites': { 'type': 'array', 'items': {}, 'title': 'Permission Overwrites' }, 'nsfw': { 'type': 'boolean', 'title': 'Nsfw' }, 'icon_emoji': { 'type': 'object', 'properties': { 'id': { 'type': 'null', 'title': 'Icon Emoji.Id' }, 'name': { 'type': 'string', 'title': 'Icon Emoji.Name' } }, 'title': 'Icon Emoji' }, 'theme_color': { 'type': 'null', 'title': 'Theme Color' }, 'voice_background_display': { 'type': 'null', 'title': 'Voice Background Display' } };

module.exports = {
    async receive(context) {

        const { channelId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Invites', value: 'result' });
        }

        // https://discord.com/developers/docs/resources/channel#get-channel-invites
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://discord.com/api/v10/channels/${channelId}/invites`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};
