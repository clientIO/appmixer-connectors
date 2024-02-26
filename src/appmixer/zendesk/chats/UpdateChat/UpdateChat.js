'use strict';
const commons = require('../../zendesk-commons');

function buildChat(oldChat, newChat) {

    const { name, email, phone, notes, message, rating, tags } = newChat;
    const chat = {};
    const visitor = {};

    if (name) {
        visitor.name = name;
    }

    if (email) {
        visitor.email = email;
    }

    if (phone) {
        visitor.phone = phone;
    }

    if (notes) {
        visitor.notes = notes;
    }

    chat.visitor = visitor;

    if (message && oldChat.type === 'chat') {
        chat.comment = message;
    }

    if (rating && oldChat.type === 'chat') {
        chat.rating = rating;
    }

    if (tags) {
        chat.tags = tags.split(',').map(tag => tag.trim());
    }

    return chat;
}

/**
 * Get chat.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const chatInfo = context.messages.in.content;
        const { id } = chatInfo;
        const chat = await commons.get(`chats/${id}`, context.auth);
        const updatedChat = await commons.update(`chats/${id}`, context.auth, buildChat(chat, chatInfo));

        return context.sendJson(updatedChat, 'chat');
    }
};
