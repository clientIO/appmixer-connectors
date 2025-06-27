'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Members', value: 'result' });
        }

        // https://discord.com/developers/docs/resources/guild#list-guild-members
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://discord.com/api/v10/guilds/${context.auth.profileInfo.guildId}/members`,
            headers: {
                'Authorization': `Bot ${context.auth.botToken}`
            }
        });

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};

const schema = {
    'flags': { 'type': 'number', 'title': 'Flags' },
    'joined_at': { 'type': 'string', 'title': 'Joined At' },
    'pending': { 'type': 'boolean', 'title': 'Pending' },
    'roles': { 'type': 'array', 'items': { 'type': 'string' }, 'title': 'Roles' },
    'user': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'User.ID' },
            'username': { 'type': 'string', 'title': 'User.Username' },
            'avatar': { 'type': 'string', 'title': 'User.Avatar' },
            'discriminator': { 'type': 'string', 'title': 'User.Discriminator' },
            'public_flags': { 'type': 'number', 'title': 'User.Public Flags' },
            'flags': { 'type': 'number', 'title': 'User.Flags' },
            'bot': { 'type': 'boolean', 'title': 'User.Bot' }
        },
        'title': 'User'
    },
    'mute': { 'type': 'boolean', 'title': 'Mute' },
    'deaf': { 'type': 'boolean', 'title': 'Deaf' }
};
