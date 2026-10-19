'use strict';

const { WebClient } = require('@slack/web-api');
const lib = require('../../lib');

const outputPortName = 'out';

// reactions.list max page size.
const PAGE_SIZE = 1000;

const ITEM_SCHEMA = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', title: 'Type', example: 'message' },
        channel: { type: 'string', title: 'Channel', example: 'C0ABC12345' },
        message: {
            type: 'object',
            title: 'Message',
            properties: {
                type: { type: 'string', title: 'Message.Type', example: 'message' },
                text: { type: 'string', title: 'Message.Text', example: 'Great work, team!' },
                user: { type: 'string', title: 'Message.User', example: 'U0ABC12345' },
                ts: { type: 'string', title: 'Message.Timestamp', example: '1737024600.333444' },
                permalink: { type: 'string', title: 'Message.Permalink', example: 'https://example.slack.com/archives/C0ABC12345/p1737024600333444' },
                files: {
                    type: 'array',
                    title: 'Message.Files',
                    example: [{ id: 'F0ABC12345' }],
                    items: { type: 'object', properties: { id: { type: 'string', title: 'Message.Files.ID', example: 'F0ABC12345' } } }
                },
                reactions: {
                    type: 'array',
                    title: 'Message.Reactions',
                    example: [{ name: 'thumbsup', count: 2, users: ['U0ABC12345', 'U0DEF67890'] }],
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', title: 'Message.Reactions.Name', example: 'thumbsup' },
                            count: { type: 'number', title: 'Message.Reactions.Count', example: 2 },
                            users: { type: 'array', title: 'Message.Reactions.Users', items: { type: 'string', example: 'U0ABC12345' } }
                        }
                    }
                }
            }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    /**
     * @link https://api.slack.com/methods/reactions.list
     */
    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { userId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Reactions' });
        }

        if (!userId) {
            throw new context.CancelError('User is required!');
        }

        const web = new WebClient(context.auth.accessToken);
        const records = [];
        let cursor;
        do {
            const result = await web.reactions.list({
                user: userId,
                limit: PAGE_SIZE,
                ...(cursor ? { cursor } : {})
            });
            records.push(...(result.items || []));
            cursor = result.response_metadata?.next_cursor;
        } while (cursor);

        await lib.sendArrayOutput({ context, outputPortName, outputType, records });
    }
};
