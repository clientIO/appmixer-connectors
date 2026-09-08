'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { chatId, messageId, text, parseMode, disableWebPagePreview } = context.messages.in.content;

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const message = await lib.apiRequest(context, 'editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: parseMode,
            link_preview_options: disableWebPagePreview ? { is_disabled: true } : undefined
        });

        return context.sendJson(message, 'out');
    }
};
