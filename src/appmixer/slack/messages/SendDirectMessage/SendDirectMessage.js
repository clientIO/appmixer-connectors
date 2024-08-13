'use strict';

const commons = require('../../slack-commons');
const { SlackAPIError } = require('../../errors');

module.exports = {

    async receive(context) {

        let { text, userId, userIds } = context.messages.in.content;
        let client = commons.getSlackAPIClient(context.auth.accessToken);
        let ids = userId;
        if (Array.isArray(userIds?.AND)) {
            ids = userIds.AND.map(user => user.id).join(',');
        }

        try {
            // First, open a conversation with the user(s). It will return the channel ID.
            const channel = await client.openConversation(ids);
            if (!channel || !channel.id) {
                throw new context.CancelError('Could not open a conversation with the user', channel);
            }

            // Then, send the message to the channel.
            const message = await client.sendMessage(channel.id, text);

            return context.sendJson(message, 'out');
        } catch (err) {
            if (err instanceof SlackAPIError) {
                throw new context.CancelError(err.apiError);
            }
            throw err;
        }
    }
};

