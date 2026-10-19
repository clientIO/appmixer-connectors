'use strict';

const lib = require('../lib');

const DEFAULT_MAX_RESULTS = 20;
const MAX_RESULTS = 1000;

// The out port is dynamic (outputType), so the item contract is exported for the offline tooling.
// Same fields as the New Channel Post trigger emits - both come from lib.formatMessage.
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        id: { type: 'integer', title: 'Message ID', example: 48213 },
        date: { type: 'string', title: 'Date', format: 'date-time', example: '2026-10-05T08:14:00.000Z' },
        text: { type: 'string', title: 'Text', example: 'Quarterly results are out: revenue up 12%.' },
        url: { type: 'string', title: 'URL', example: 'https://t.me/durov/48213' },
        views: { type: 'integer', title: 'Views', example: 15634 },
        forwards: { type: 'integer', title: 'Forwards', example: 87 },
        replies: { type: 'integer', title: 'Replies', example: 12 },
        media_type: { type: 'string', title: 'Media Type', example: 'photo' },
        fwd_from_channel: { type: 'string', title: 'Forwarded From Channel', example: 'telegram' },
        fwd_from_channel_id: { type: 'string', title: 'Forwarded From Channel ID', example: '1005640892' },
        fwd_from_message_id: { type: 'integer', title: 'Forwarded From Message ID', example: 391 },
        reply_to_id: { type: 'integer', title: 'Reply To Message ID', example: 48190 },
        grouped_id: { type: 'string', title: 'Album ID', example: '13792745312904855' },
        edit_date: { type: 'string', title: 'Edit Date', format: 'date-time', example: '2026-10-05T08:20:00.000Z' },
        post_author: { type: 'string', title: 'Post Author', example: 'Pavel' },
        channel_id: { type: 'string', title: 'Channel ID', example: '1006503122' },
        channel_username: { type: 'string', title: 'Channel Username', example: 'durov' },
        channel_title: { type: 'string', title: 'Channel Title', example: 'Du Rove\'s Channel' }
    },
    required: ['id', 'date', 'text', 'url', 'channel_id', 'channel_title']
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { channel: channelInput, maxResults, minId, offsetDate, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Messages' });
        }

        if (!channelInput) {
            throw new context.CancelError('Channel is required!');
        }

        const max = Math.min(Math.max(parseInt(maxResults, 10) || DEFAULT_MAX_RESULTS, 1), MAX_RESULTS);
        const sinceId = Math.max(parseInt(minId, 10) || 0, 0);
        let before = 0;

        if (offsetDate) {
            const time = Date.parse(offsetDate);
            if (Number.isNaN(time)) {
                throw new context.CancelError(`Invalid Before Date "${offsetDate}".`);
            }
            before = Math.floor(time / 1000);
        }

        const username = lib.normalizeUsername(context, channelInput);
        const client = await lib.getClient(context);
        const channel = await lib.resolveChannel(context, client, username);

        // Newest first: page backwards with offset_id = the oldest id seen so far.
        const records = [];
        let offsetId = 0;

        while (records.length < max) {
            const pageLimit = Math.min(lib.PAGE_SIZE, max - records.length);
            const { messages, chats, channel: current } = await lib.getHistory(context, client, channel, {
                offsetId,
                offsetDate: offsetId ? 0 : before,
                limit: pageLimit,
                minId: sinceId
            });

            if (!messages.length) {
                break;
            }

            messages.forEach(message => {
                const record = lib.formatMessage(message, current, chats);
                if (record && records.length < max) {
                    records.push(record);
                }
            });

            offsetId = Math.min(...messages.map(message => message.id));

            if (messages.length < pageLimit) {
                break;
            }
        }

        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
