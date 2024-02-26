'use strict';
const commons = require('../../zendesk-commons');

/**
 * Delete chat.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        await commons.delete(`chats/${id}`, context.auth);

        return context.sendJson({ id }, 'deleted');
    }
};
