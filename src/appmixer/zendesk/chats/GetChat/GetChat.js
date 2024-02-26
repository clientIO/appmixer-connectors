'use strict';
const commons = require('../../zendesk-commons');

/**
 * Get chat.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        const chat = await commons.get(`chats/${id}`, context.auth);

        return context.sendJson(chat, 'chat');
    }
};
