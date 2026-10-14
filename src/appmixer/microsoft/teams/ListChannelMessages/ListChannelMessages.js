'use strict';

const lib = require('../lib');
const { chatMessage: ITEM_SCHEMA } = require('../schemas');

// Graph caps $top at 50 for channel messages.
const PAGE_SIZE = 50;

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { teamId, channelId, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Messages' });
        }

        if (!teamId) {
            throw new context.CancelError('Team is required!');
        }
        if (!channelId) {
            throw new context.CancelError('Channel is required!');
        }

        const path = `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`;
        const records = await lib.listAll(context, path, { $top: PAGE_SIZE });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
