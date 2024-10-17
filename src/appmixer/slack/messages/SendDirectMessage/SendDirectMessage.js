'use strict';

const commons = require('../../lib');
const { SlackAPIError } = require('../../errors');

module.exports = {

    async receive(context) {

        let { text, userIds } = context.messages.in.content;
        let client = commons.getSlackAPIClient(context.auth.accessToken);
        if (userIds.length > 8) {
            throw new context.CancelError('You can send a message to a maximum of 8 users at once');
        }
        let ids = userIds?.join(',');

        try {
            // First, open a conversation with the user(s). It will return the channel ID.
            const channel = await client.openConversation(ids);
            if (!channel || !channel.id) {
                const errorDetails = JSON.stringify({ channel, userIds });
                throw new context.CancelError('Could not open a conversation with a user. Details: ' + errorDetails);
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

