'use strict';

const lib = require('../lib');

// Graph caps $top at 50 for chats, and returns at most 25 members per chat when expanding.
const PAGE_SIZE = 50;

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'chatType'],
    properties: {
        id: { type: 'string', title: 'Chat ID', example: '19:2da4c29f6d7041eca70b638b43d45437@thread.v2' },
        topic: { type: 'string', title: 'Topic', example: 'Quarterly results' },
        chatType: { type: 'string', title: 'Chat Type', example: 'group' },
        createdDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Created Date Time',
            example: '2026-08-03T19:41:07.054Z'
        },
        lastUpdatedDateTime: {
            type: 'string',
            format: 'date-time',
            title: 'Last Updated Date Time',
            example: '2026-09-15T08:30:00.035Z'
        },
        webUrl: {
            type: 'string',
            title: 'Web URL',
            example: 'https://teams.microsoft.com/l/chat/19%3A561082c0f3f847a58069deb8eb300807%40thread.v2/0'
        }
    }
};

const listChats = (context, expandMembers) => {

    const params = { $top: PAGE_SIZE };
    if (expandMembers) {
        params.$expand = 'members';
    }
    return lib.listAll(context, '/me/chats', params);
};

/**
 * A one-on-one chat has no topic, so the picker falls back to the other members' names.
 * @param {object} chat
 * @param {string} [meId] - the caller, who is a member of every chat and adds nothing to the label
 * @return {string}
 */
const chatLabel = (chat, meId) => {

    if (chat.topic) {
        return chat.topic;
    }

    const names = (chat.members || [])
        .filter((member) => member.userId !== meId)
        .map((member) => member.displayName)
        .filter(Boolean);

    return names.length ? names.join(', ') : `${chat.chatType || 'chat'} ${String(chat.id).slice(-8)}`;
};

const toSelectArray = (message) => {

    const chats = Array.isArray(message) ? message : (message?.result || []);
    return chats.map((chat) => ({ label: chat.label || chat.topic || chat.id, value: chat.id }));
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Chats' });
        }

        if (!isSource) {
            const records = await listChats(context);
            return lib.sendArrayOutput({ context, outputType, records });
        }

        // Source call: backs the Chat picker. Errors render an empty picker - the user can
        // still type the Chat ID.
        try {
            const options = await lib.callCached(context, 'chats', async () => {

                let chats;
                let meId;
                try {
                    // Members carry the display names the labels are built from.
                    [chats, meId] = await Promise.all([
                        listChats(context, true),
                        lib.getMe(context).then((me) => me.id)
                    ]);
                } catch (error) {
                    // Expanding members needs more than Chat.ReadBasic in some tenants.
                    chats = await listChats(context);
                }

                // Only the fields the picker needs, to keep the cache small.
                return chats.map((chat) => ({ id: chat.id, label: chatLabel(chat, meId) }));
            });
            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        }
    },

    toSelectArray
};
