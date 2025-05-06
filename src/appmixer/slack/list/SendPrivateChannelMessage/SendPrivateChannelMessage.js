/* eslint-disable camelcase */
'use strict';
const lib = require('../../lib');

/**
 * Component which sends new message to private channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { channelId, text, asBot, thread_ts, reply_broadcast } = context.messages.message.content;

        const message = await lib.sendMessage(context, channelId, text, asBot, thread_ts, reply_broadcast);
        return context.sendJson(message, 'newMessage');
    }
};
