'use strict';

const { Api } = require('teleproto');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { channel: channelInput } = context.messages.in.content;

        if (!channelInput) {
            throw new context.CancelError('Channel is required!');
        }

        const username = lib.normalizeUsername(context, channelInput);
        const client = await lib.getClient(context);
        const ref = await lib.resolveChannel(context, client, username);
        const result = await lib.invoke(
            context,
            client,
            new Api.channels.GetFullChannel({ channel: lib.inputChannel(ref) }),
            `@${username}`
        );
        const full = result.fullChat || {};
        // The reference only addresses the channel; its flags come with the full channel.
        const channel = (result.chats || []).find(chat => String(chat.id) === ref.id) || ref;
        const channelUsername = lib.channelUsername(channel);

        return context.sendJson({
            id: String(channel.id),
            username: channelUsername,
            title: channel.title,
            description: full.about || '',
            url: channelUsername ? `https://t.me/${channelUsername}` : null,
            type: channel.megagroup ? 'group' : 'channel',
            subscribers_count: full.participantsCount === undefined ? null : Number(full.participantsCount),
            is_public: Boolean(channelUsername),
            is_verified: Boolean(channel.verified),
            is_scam: Boolean(channel.scam),
            is_fake: Boolean(channel.fake),
            is_restricted: Boolean(channel.restricted),
            restriction_reason: (channel.restrictionReason || []).map(reason => reason.text).filter(Boolean).join(' ') || null,
            created_at: channel.date ? new Date(channel.date * 1000).toISOString() : null,
            linked_chat_id: full.linkedChatId ? String(full.linkedChatId) : null
        }, 'out');
    }
};
