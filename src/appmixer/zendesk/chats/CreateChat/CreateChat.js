'use strict';
const uuidv4 = require('uuid/v4');
const moment = require('moment');
const commons = require('../../zendesk-commons');

function buildChat(chatInfo) {

    const chat = {
        visitor: {
            id: uuidv4(),
            name: chatInfo['name'],
            email: chatInfo['email'] ? chatInfo['email'] : '',
            phone: chatInfo['phone'] ? chatInfo['phone'] : '',
            notes: chatInfo['notes'] ? chatInfo['notes'] : ''
        },
        type: 'offline_msg',
        message: chatInfo['message'],
        timestamp: moment(chatInfo['timestamp']).unix(),
        session: {}
    };

    return chat;
}

/**
 * Get chat.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const chatInfo = context.messages.in.content;
        const chat = await commons.post('chats', context.auth, buildChat(chatInfo));

        return context.sendJson(chat, 'chat');
    }
};
