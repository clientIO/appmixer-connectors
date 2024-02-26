'use strict';
const commons = require('../../zendesk-commons');

/**
 * Process chat to find newly added.
 * @param {Set} knownChats
 * @param {Set} actualChats
 * @param {Set} newChats
 * @param {Object} chat
 */
function processChats(knownChats, actualChats, newChats, chat) {

    if (knownChats && !knownChats.has(chat['id'])) {
        newChats.add(chat);
    }
    actualChats.add(chat['id']);
}

/**
 * Component which triggers whenever new chat comes.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const response = await commons.get('chats', context.auth);
        const chats = response['chats'];

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(chats)) {
            chats.forEach(processChats.bind(null, known, actual, diff));
        }
        context.state = { known: Array.from(actual) };

        if (diff.size) {
            const promises = [];
            diff.forEach(chat => {
                promises.push(context.sendJson(chat, 'chat'));
            });
            return Promise.all(promises);
        }
    }
};
