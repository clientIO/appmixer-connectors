'use strict';

const lib = require('../../lib.generated');

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

        if (!Array.isArray(data) || !data.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};

const schema = {
    'type': { 'type': 'number', 'title': 'Type' },
    'code': { 'type': 'string', 'title': 'Code' },
    'inviter': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'Inviter.ID' },
            'username': { 'type': 'string', 'title': 'Inviter.Username' },
            'discriminator': { 'type': 'string', 'title': 'Inviter.Discriminator' },
            'public_flags': { 'type': 'number', 'title': 'Inviter.Public Flags' },
            'flags': { 'type': 'number', 'title': 'Inviter.Flags' }
        },
        'title': 'Inviter'
    },
    'max_age': { 'type': 'number', 'title': 'Max Age' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'expires_at': { 'type': 'string', 'title': 'Expires At' },
    'guild': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'Guild.ID' },
            'name': { 'type': 'string', 'title': 'Guild.Name' },
            'features': { 'type': 'array', 'items': {}, 'title': 'Guild.Features' },
            'verification_level': { 'type': 'number', 'title': 'Guild.Verification Level' },
            'nsfw_level': { 'type': 'number', 'title': 'Guild.Nsfw Level' },
            'nsfw': { 'type': 'boolean', 'title': 'Guild.Nsfw' },
            'premium_subscription_count': { 'type': 'number', 'title': 'Guild.Premium Subscription Count' },
            'premium_tier': { 'type': 'number', 'title': 'Guild.Premium Tier' }
        },
        'title': 'Guild'
    },
    'guild_id': { 'type': 'string', 'title': 'Guild ID' },
    'channel': {
        'type': 'object', 'properties': {
            'id': { 'type': 'string', 'title': 'Channel.ID' },
            'type': { 'type': 'number', 'title': 'Channel.Type' },
            'name': { 'type': 'string', 'title': 'Channel.Name' }
        },
        'title': 'Channel'
    },
    'uses': { 'type': 'number', 'title': 'Uses' },
    'max_uses': { 'type': 'number', 'title': 'Max Uses' },
    'temporary': { 'type': 'boolean', 'title': 'Temporary' }
};
