'use strict';
const commons = require('../../zendesk-commons');

/**
 * List all chats.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const response = await commons.get('chats', context.auth);
        return context.sendJson(response.chats, 'chats');
    },

    chatsToSelectArray(chats) {

        if (chats && Array.isArray(chats)) {
            return chats.map(c => ({ label: c.visitor['name'], value: c.id }));
        }
        return [];
    }
};
