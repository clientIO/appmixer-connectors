'use strict';

const lib = require('../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'displayName'],
    properties: {
        id: { type: 'string', title: 'Channel ID', example: '19:4a95f7d8db4c4e7fae857bcebe0623e6@thread.tacv2' },
        displayName: { type: 'string', title: 'Display Name', example: 'General' },
        description: { type: 'string', title: 'Description', example: 'Announcements and general discussion.' },
        membershipType: { type: 'string', title: 'Membership Type', example: 'standard' },
        email: { type: 'string', title: 'Email', example: 'Marketing@contoso.onmicrosoft.com' },
        webUrl: {
            type: 'string',
            title: 'Web URL',
            example: 'https://teams.microsoft.com/l/channel/19%3A4a95f7d8db4c4e7fae857bcebe0623e6%40thread.tacv2/General'
        },
        createdDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Created Date Time',
            example: '2026-01-12T09:15:32.123Z'
        }
    }
};

const listChannels = (context, teamId) => {

    return lib.listAll(context, `/teams/${encodeURIComponent(teamId)}/channels`);
};

const toSelectArray = (message) => {

    // Accepts both the current `{ result }` output and the pre-2.0.0 bare array.
    const channels = Array.isArray(message) ? message : (message?.result || []);
    return channels.map((channel) => ({ label: channel.displayName || channel.id, value: channel.id }));
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { teamId, outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Channels' });
        }

        if (!isSource) {
            if (!teamId) {
                throw new context.CancelError('Team is required!');
            }
            const records = await listChannels(context, teamId);
            return lib.sendArrayOutput({ context, outputType, records });
        }

        // Source call: backs the Channel picker. Without a team there is nothing to list,
        // and errors render an empty picker - the user can still type the Channel ID.
        if (!teamId) {
            return context.sendJson({ result: [] }, 'out');
        }
        try {
            const options = await lib.callCached(context, `channels:${teamId}`, async () => {
                const channels = await listChannels(context, teamId);
                // Only the fields the picker needs, to keep the cache small.
                return channels.map(({ id, displayName }) => ({ id, displayName }));
            });
            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        }
    },

    toSelectArray,

    // Pre-2.0.0 name of the transform, kept for inspectors that still reference it.
    channelsToSelectArray: toSelectArray
};
