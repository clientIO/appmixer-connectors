/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');
const { WebClient } = require('@slack/web-api');

const outputPortName = 'channels';

// conversations.list max page size.
const PAGE_SIZE = 999;

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
        id:          { type: 'string',  title: 'Channel ID',              example: 'C01234567' },
        name:        { type: 'string',  title: 'Channel Name',            example: 'general' },
        is_private:  { type: 'boolean', title: 'Is Private',              example: false },
        is_archived: { type: 'boolean', title: 'Is Archived',             example: false },
        is_general:  { type: 'boolean', title: 'Is General',              example: true },
        is_member:   { type: 'boolean', title: 'Is Member',               example: true },
        created:     { type: 'number',  title: 'Created (Unix timestamp)', example: 1609459200 },
        num_members: { type: 'number',  title: 'Member Count',            example: 42 },
        creator:     { type: 'string',  title: 'Creator User ID',         example: 'U01234567' },
        topic: {
            type: 'object', title: 'Topic',
            properties: {
                value:    { type: 'string', title: 'Topic.Value',    example: 'Company announcements' },
                creator:  { type: 'string', title: 'Topic.Creator',  example: 'U01234567' },
                last_set: { type: 'number', title: 'Topic.Last Set', example: 1609459200 }
            }
        },
        purpose: {
            type: 'object', title: 'Purpose',
            properties: {
                value:    { type: 'string', title: 'Purpose.Value',    example: 'This channel is for team-wide communication' },
                creator:  { type: 'string', title: 'Purpose.Creator',  example: 'U01234567' },
                last_set: { type: 'number', title: 'Purpose.Last Set', example: 1609459200 }
            }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    /**
     * @link https://api.slack.com/methods/conversations.list
     */
    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, types = 'public_channel,private_channel' } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
                label: 'Channels', outputPortName
            });
        }

        const web = new WebClient(context.auth.accessToken);
        const records = [];
        let cursor;

        do {
            const response = await web.conversations.list({
                limit: PAGE_SIZE,
                types,
                exclude_archived: true,
                ...(cursor ? { cursor } : {})
            });
            records.push(...response.channels);
            cursor = response.response_metadata?.next_cursor;
        } while (cursor);

        // When called as a dropdown source (no outputType), preserve original behaviour
        // so consuming components' channelsToSelectArray transform still works.
        if (!outputType) {
            return context.sendJson(records, outputPortName);
        }

        return lib.sendArrayOutput({ context, outputPortName, outputType, records });
    },

    channelsToSelectArray(channels) {

        if (!Array.isArray(channels)) return [];

        return channels
            .filter(channel => channel['is_member'])
            .map(channel => ({
                label: channel['name'],
                value: channel['id']
            }));
    }
};
