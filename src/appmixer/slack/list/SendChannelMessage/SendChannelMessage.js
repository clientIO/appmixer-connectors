'use strict';
const lib = require('../../lib');

/**
 * Component which sends new message to public channel.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { channelId, text } = context.messages.message.content;

        const message = await lib.sendMessage(channelId, text, context.auth.accessToken);
        return context.sendJson(message, 'newMessage');
    }
};
