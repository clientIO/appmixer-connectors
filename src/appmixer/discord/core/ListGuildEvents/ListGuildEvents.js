'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { withUserCount, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Events', value: 'result' });
        }

        // https://discord.com/developers/docs/resources/guild-scheduled-event#list-scheduled-events-for-guild
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/scheduled-events`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            },
            params: {
                with_user_count: withUserCount
            }
        });

        if (!Array.isArray(data) || !data.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};

const schema = {
    'id': { 'type': 'string', 'title': 'Guild Event ID' },
    'guild_id': { 'type': 'string', 'title': 'Guild ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'description': { 'type': 'string', 'title': 'Description' },
    'creator_id': { 'type': 'string', 'title': 'Creator ID' },
    'creator': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'Creator.ID' },
            'username': { 'type': 'string', 'title': 'Creator.Username' },
            'avatar': { 'type': 'string', 'title': 'Creator.Avatar' },
            'discriminator': { 'type': 'string', 'title': 'Creator.Discriminator' },
            'public_flags': { 'type': 'number', 'title': 'Creator.Public Flags' },
            'flags': { 'type': 'number', 'title': 'Creator.Flags' },
            'bot': { 'type': 'boolean', 'title': 'Creator.Bot' },
            'banner': { 'type': 'string', 'title': 'Creator.Banner' }
        },
        'title': 'Creator'
    },
    'scheduled_start_time': { 'type': 'string', 'title': 'Scheduled Start Time' },
    'scheduled_end_time': { 'type': 'string', 'title': 'Scheduled End Time' },
    'status': { 'type': 'number', 'title': 'Status' },
    'entity_type': { 'type': 'number', 'title': 'Entity Type' },
    'user_count': { 'type': 'number', 'title': 'User Count' },
    'privacy_level': { 'type': 'number', 'title': 'Privacy Level' },
    'sku_ids': { 'type': 'array', 'items': {}, 'title': 'Sku Ids' },
    'guild_scheduled_event_exceptions': { 'type': 'array', 'items': {}, 'title': 'Guild Scheduled Event Exceptions' },
    'entity_metadata': {
        'type': 'object', 'properties': {
            'location': { 'type': 'string', 'title': 'Entity Metadata.Location' }
        },
        'title': 'Entity Metadata'
    }
};
