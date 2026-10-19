/* eslint-disable camelcase */
'use strict';
const lib = require('../../lib');

/**
 * Component which sends new message to private channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            channelId,
            text,
            asBot,
            username,
            iconUrl
        } = context.messages.message.content;
        const { threadTs, replyBroadcast } = lib.getThreadInputs(context.messages.message.content);

        if (!channelId) {
            throw new context.CancelError('Channel is required!');
        }
        if (!text) {
            throw new context.CancelError('Message is required!');
        }

        const options = {};
        if (username) options.username = username;
        if (iconUrl) options.iconUrl = iconUrl;

        const message = await lib.sendMessage(
            context,
            channelId,
            text,
            asBot,
            threadTs,
            replyBroadcast,
            options
        );
        return context.sendJson(message, 'newMessage');
    }
};
