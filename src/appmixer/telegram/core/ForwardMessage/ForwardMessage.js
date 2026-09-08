'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            chatId,
            fromChatId,
            messageId,
            disableNotification,
            protectContent,
            messageThreadId
        } = context.messages.in.content;

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        if (!fromChatId) {
            throw new context.CancelError('From Chat ID is required!');
        }

        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        const message = await lib.apiRequest(context, 'forwardMessage', {
            chat_id: chatId,
            from_chat_id: fromChatId,
            message_id: messageId,
            disable_notification: disableNotification,
            protect_content: protectContent,
            message_thread_id: messageThreadId
        });

        return context.sendJson(message, 'out');
    }
};
