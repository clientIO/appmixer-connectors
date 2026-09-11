'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { chatId, messageId } = context.messages.in.content;

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        try {
            await lib.apiRequest(context, 'deleteMessage', {
                chat_id: chatId,
                message_id: messageId
            });
        } catch (error) {
            // Telegram's own wording ("message can't be deleted for everyone") says nothing
            // about WHY; the usual cause is the default permission model.
            if (error.status === 400 && /can't be deleted/i.test(error.message)) {
                throw new context.CancelError(
                    `${error.message} By default a bot can delete only its own messages (and incoming `
                    + 'messages in private chats), and only for 48 hours after they were sent. To delete '
                    + `messages of other members of chat ${chatId}, make the bot an administrator with the `
                    + '"Delete messages" right.'
                );
            }
            throw error;
        }

        return context.sendJson({}, 'out');
    }
};
