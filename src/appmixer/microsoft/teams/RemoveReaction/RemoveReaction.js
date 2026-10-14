'use strict';

const react = require('../reactions');

module.exports = {

    async receive(context) {

        const { location = 'channel', teamId, channelId, chatId, messageId, reactionType } =
            context.messages.in.content;

        if (location === 'chat') {
            if (!chatId) {
                throw new context.CancelError('Chat is required!');
            }
        } else {
            if (!teamId) {
                throw new context.CancelError('Team is required!');
            }
            if (!channelId) {
                throw new context.CancelError('Channel is required!');
            }
        }
        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }
        if (!reactionType) {
            throw new context.CancelError('Reaction is required!');
        }

        return react(context, 'unsetReaction');
    }
};
