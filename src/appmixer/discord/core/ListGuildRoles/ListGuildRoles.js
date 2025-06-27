'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Roles', value: 'result' });
        }

        // https://discord.com/developers/docs/resources/guild#get-guild-roles
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://discord.com/api/v10/guilds/{context.auth.profileInfo.guildId}/roles',
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return lib.sendArrayOutput({ context, records: data, outputType });
    },

    toSelectArray({ result }) {

        return result.map(role => {
            return { label: role.name, value: role.id };
        });
    }
};

const schema = {
    'id': { 'type': 'string', 'title': 'Role ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'description': { 'type': 'null', 'title': 'Description' },
    'permissions': { 'type': 'string', 'title': 'Permissions' },
    'position': { 'type': 'number', 'title': 'Position' },
    'color': { 'type': 'number', 'title': 'Color' },
    'colors': {
        'type': 'object', 'properties': {
            'primary_color': { 'type': 'number', 'title': 'Colors.Primary Color' },
            'secondary_color': { 'type': 'null', 'title': 'Colors.Secondary Color' },
            'tertiary_color': { 'type': 'null', 'title': 'Colors.Tertiary Color' }
        }, 'title': 'Colors'
    },
    'hoist': { 'type': 'boolean', 'title': 'Hoist' },
    'managed': { 'type': 'boolean', 'title': 'Managed' },
    'mentionable': { 'type': 'boolean', 'title': 'Mentionable' },
    'icon': { 'type': 'null', 'title': 'Icon' },
    'unicode_emoji': { 'type': 'null', 'title': 'Unicode Emoji' },
    'flags': { 'type': 'number', 'title': 'Flags' }
};
