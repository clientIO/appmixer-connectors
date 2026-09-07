'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { chatId } = context.messages.in.content;

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        const chat = await lib.apiRequest(context, 'getChat', { chat_id: chatId });

        return context.sendJson(chat, 'out');
    }
};
