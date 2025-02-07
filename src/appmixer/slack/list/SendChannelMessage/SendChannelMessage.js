'use strict';
const lib = require('../../lib');

/**
 * Component which sends new message to public channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { channelId, text, asBot } = context.messages.message.content;

        const message = await lib.sendMessage(context, channelId, text, asBot);
        return context.sendJson(message, 'newMessage');
    }
};
