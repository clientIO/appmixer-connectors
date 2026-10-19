'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            chatId,
            photo,
            fileId,
            caption,
            parseMode,
            disableNotification,
            protectContent,
            messageThreadId,
            replyToMessageId
        } = context.messages.in.content;

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        const message = await lib.sendMedia(context, 'sendPhoto', 'photo', {
            fileId,
            remote: photo,
            params: {
                chat_id: chatId,
                caption,
                parse_mode: parseMode,
                disable_notification: disableNotification,
                protect_content: protectContent,
                message_thread_id: messageThreadId,
                reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
            }
        });

        return context.sendJson(message, 'out');
    }
};
